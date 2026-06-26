/**
 * Evidence Engine — evaluator.
 *
 * Pure, deterministic, rule-based. Compares a complaint analysis with the
 * transaction the matcher selected, and returns:
 *
 *   {
 *     evidenceVerdict: 'consistent' | 'inconsistent' | 'insufficient_data',
 *     matchedFacts:    string[],
 *     conflictingFacts: string[],
 *     missingFacts:    string[],
 *     reasoning:       string[]
 *   }
 *
 * The verdict is decided by counting weighted conflicts vs. supports and
 * gating on data completeness. No randomness, no I/O, no LLMs.
 */

// --- Verdict weight table ---
// Each field carries a weight. Supports add weight, conflicts subtract.
// The sum decides the verdict relative to the field pool observed.
const FIELD_WEIGHTS = Object.freeze({
  amount: 3,
  transaction_type: 2,
  status: 3,        // status contradictions are the strongest signal
  time_reference: 1,
  counterparty: 1,
});

// Critical fields — if BOTH sides have the field and they disagree, that
// alone forces 'inconsistent' even if supports outnumber conflicts.
// Status is the most damning: a successful tx contradicts a "failed"
// complaint cleanly.
const CRITICAL_FIELDS = Object.freeze(new Set(['amount', 'status']));

// Minimum score coverage required for 'consistent' vs. 'insufficient_data'.
// Below this, we don't have enough cross-checks to trust the verdict either
// way, so we fall back to 'insufficient_data'.
const MIN_SCORE_FOR_CONSISTENT = 5;
const MIN_COVERAGE_FOR_CONSISTENT = 0.5; // fraction of fields that must be present on BOTH sides

const emptyResult = () => ({
  evidenceVerdict: 'insufficient_data',
  matchedFacts: [],
  conflictingFacts: [],
  missingFacts: [],
  reasoning: [],
});

const norm = (v) =>
  typeof v === 'string' ? v.trim().toLowerCase() : v == null ? null : v;

const toNumber = (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[, ]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const amountsMatch = (a, b) => {
  const x = toNumber(a);
  const y = toNumber(b);
  if (x === null || y === null) return null; // missing
  if (x === y) return true;
  // Allow ±5% or ±50 unit tolerance, mirroring the matcher.
  const tol = Math.max(50, Math.abs(x) * 0.05);
  return Math.abs(x - y) <= tol;
};

// --- Per-field evaluators ---
// Each returns { kind: 'support' | 'conflict' | 'missing' | 'absent', fact?: string, reason: string }.

const evalAmount = (analysisAmount, tx) => {
  if (analysisAmount == null || tx?.amount == null) {
    return {
      kind: 'missing',
      fact: 'amount',
      reason: 'Amount is not clearly mentioned in the complaint.',
    };
  }
  if (amountsMatch(analysisAmount, tx.amount)) {
    return {
      kind: 'support',
      fact: 'amount',
      reason: 'Amount matches the transaction history.',
    };
  }
  return {
    kind: 'conflict',
    fact: 'amount',
    reason: 'Amount in the complaint does not match the transaction record.',
  };
};

const evalType = (analysisType, tx) => {
  if (analysisType == null || tx?.type == null) {
    return {
      kind: 'missing',
      fact: 'transaction_type',
      reason: 'Transaction type is not clearly mentioned in the complaint.',
    };
  }
  if (norm(analysisType) === norm(tx.type)) {
    return {
      kind: 'support',
      fact: 'transaction_type',
      reason: 'Transaction type matches the complaint description.',
    };
  }
  return {
    kind: 'conflict',
    fact: 'transaction_type',
    reason: 'Transaction type contradicts the complaint description.',
  };
};

const evalStatus = (analysisStatus, tx) => {
  if (analysisStatus == null || tx?.status == null) {
    return {
      kind: 'missing',
      fact: 'status',
      reason: 'Transaction status is not clearly mentioned in the complaint.',
    };
  }
  if (norm(analysisStatus) === norm(tx.status)) {
    return {
      kind: 'support',
      fact: 'status',
      reason: 'Transaction status matches the complaint description.',
    };
  }
  return {
    kind: 'conflict',
    fact: 'status',
    reason: 'Transaction status contradicts the complaint description.',
  };
};

const evalTime = (analysisTime, matchResult) => {
  if (analysisTime == null) {
    return {
      kind: 'missing',
      fact: 'time_reference',
      reason: 'Time reference is not clearly mentioned in the complaint.',
    };
  }
  // If the matcher already credited time_reference, we treat that as support.
  if (Array.isArray(matchResult?.matchedFields) && matchResult.matchedFields.includes('time_reference')) {
    return {
      kind: 'support',
      fact: 'time_reference',
      reason: 'Transaction occurred within the requested time window.',
    };
  }
  return {
    kind: 'conflict',
    fact: 'time_reference',
    reason: 'Transaction occurred outside the requested time window.',
  };
};

const evalCounterparty = (analysisCp, matchResult) => {
  if (analysisCp == null) {
    return {
      kind: 'missing',
      fact: 'counterparty',
      reason: 'Counterparty is not clearly mentioned in the complaint.',
    };
  }
  if (Array.isArray(matchResult?.matchedFields) && matchResult.matchedFields.includes('counterparty_reference')) {
    return {
      kind: 'support',
      fact: 'counterparty',
      reason: 'Counterparty in the complaint matches the transaction record.',
    };
  }
  return {
    kind: 'conflict',
    fact: 'counterparty',
    reason: 'Counterparty in the complaint does not match the transaction record.',
  };
};

// --- Verdict roll-up ---
const rollupVerdict = (evaluations) => {
  // Tally supports/conflicts/missings using weights.
  let supportScore = 0;
  let conflictScore = 0;
  let observed = 0;       // fields present on BOTH sides (eligible to influence verdict)
  let conflictCritical = false;
  let missingCritical = false;

  for (const ev of evaluations) {
    if (ev.kind === 'missing') {
      if (CRITICAL_FIELDS.has(ev.fact)) missingCritical = true;
      continue;
    }
    observed += 1;
    if (ev.kind === 'support') {
      supportScore += FIELD_WEIGHTS[ev.fact] ?? 1;
    } else if (ev.kind === 'conflict') {
      conflictScore += FIELD_WEIGHTS[ev.fact] ?? 1;
      if (CRITICAL_FIELDS.has(ev.fact)) conflictCritical = true;
    }
  }

  // Critical contradiction: any disagreement on a critical field flips
  // the verdict to 'inconsistent' regardless of net score, because such
  // contradictions are the strongest single signal (e.g. status mismatch).
  if (conflictCritical) return 'inconsistent';

  // Missing a critical signal from the complaint means we can't fully
  // verify the story. Fall back to insufficient_data even when other
  // fields agree, so callers don't over-trust a partial confirmation.
  if (missingCritical) return 'insufficient_data';

  // Non-critical: require net conflict > net support to call inconsistent.
  // Equal score means the evidence is mixed → we cannot claim either side.
  if (conflictScore > supportScore) return 'inconsistent';
  if (conflictScore === supportScore && conflictScore > 0) return 'insufficient_data';

  // No data on either side for any field → insufficient.
  if (observed === 0) return 'insufficient_data';

  // We have some data, but coverage too thin to trust a "consistent" call.
  const totalFields = Object.keys(FIELD_WEIGHTS).length;
  const coverage = observed / totalFields;
  if (supportScore >= MIN_SCORE_FOR_CONSISTENT && coverage >= MIN_COVERAGE_FOR_CONSISTENT) {
    return 'consistent';
  }

  return 'insufficient_data';
};

/**
 * Evaluate evidence.
 *
 * @param {object} analysis     Output of complaintAnalysis.analyzeComplaint
 * @param {object} matchResult  Output of transactionMatcher.matchTransaction
 *                              ({ matchedTransaction, matchedFields, ... })
 * @returns {{evidenceVerdict:string, matchedFacts:string[], conflictingFacts:string[],
 *            missingFacts:string[], reasoning:string[]}}
 */
const evaluateEvidence = (analysis, matchResult) => {
  const baseResult = emptyResult();
  if (!analysis) {
    return {
      ...baseResult,
      reasoning: ['No complaint analysis available to compare against the transaction record.'],
    };
  }
  const tx = matchResult && matchResult.matchedTransaction;
  if (!tx) {
    return {
      ...baseResult,
      reasoning: ['No matching transaction was found, so evidence could not be verified.'],
    };
  }

  const evaluations = [
    evalAmount(analysis.amount, tx),
    evalType(analysis.transaction_type, tx),
    evalStatus(analysis.transaction_status_if_mentioned, tx),
    evalTime(analysis.time_reference, matchResult),
    evalCounterparty(analysis.counterparty_reference, matchResult),
  ];

  const matchedFacts = [];
  const conflictingFacts = [];
  const missingFacts = [];
  const reasoning = [];

  for (const ev of evaluations) {
    reasoning.push(ev.reason);
    if (ev.kind === 'support') matchedFacts.push(ev.fact);
    else if (ev.kind === 'conflict') conflictingFacts.push(ev.fact);
    else missingFacts.push(ev.fact);
  }

  const verdict = rollupVerdict(evaluations);

  // Add a single closing reasoning line summarising the decision.
  let summary;
  if (verdict === 'consistent') {
    summary = 'Overall, the transaction record supports the complaint.';
  } else if (verdict === 'inconsistent') {
    summary = 'Overall, the transaction record contradicts the complaint.';
  } else {
    summary = 'Overall, there is not enough information to verify the complaint from the transaction record alone.';
  }

  return {
    evidenceVerdict: verdict,
    matchedFacts,
    conflictingFacts,
    missingFacts,
    reasoning: [...reasoning, summary],
  };
};

module.exports = {
  evaluateEvidence,
  // re-exported for unit testing
  _internals: {
    FIELD_WEIGHTS,
    CRITICAL_FIELDS,
    rollupVerdict,
    evalAmount,
    evalType,
    evalStatus,
    evalTime,
    evalCounterparty,
  },
};