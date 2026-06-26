/**
 * Transaction Matcher — candidate scoring & selection.
 *
 * Walks each transaction, computes a per-field breakdown via scoring.js,
 * picks the highest-scoring candidate that passes the confidence threshold
 * AND leads the runner-up by a minimum margin.
 *
 * Deterministic: ties are broken by transaction id (stable insertion order
 * preserved via index), then by a stable field-priority list.
 */

const {
  WEIGHTS,
  SCORE_MAX,
  CONFIDENCE_MIN_THRESHOLD,
  CONFIDENCE_MIN_MARGIN,
  scoreAmount,
  scoreType,
  scoreStatus,
  scoreTime,
  scoreCounterparty,
  scoreKeywords,
} = require('./scoring');

const emptyBreakdown = () => ({
  amount: 0,
  transactionType: 0,
  status: 0,
  time: 0,
  counterparty: 0,
  keywords: 0,
});

const emptyResult = () => ({
  matchedTransaction: null,
  confidence: 0,
  matchedFields: [],
  scoreBreakdown: emptyBreakdown(),
});

// Tie-breaker priority when scores are equal: more matched fields wins,
// then lower original index wins (stable).
const scoreCandidate = (analysis, tx, nowMs, index) => {
  const breakdown = emptyBreakdown();
  const matchedFields = [];

  const amount = scoreAmount(analysis.amount, tx.amount);
  if (amount.score > 0) {
    breakdown.amount = amount.score;
    matchedFields.push('amount');
  }

  const type = scoreType(analysis.transaction_type, tx.type);
  if (type.score > 0) {
    breakdown.transactionType = type.score;
    matchedFields.push('transaction_type');
  }

  const status = scoreStatus(
    analysis.transaction_status_if_mentioned,
    tx.status
  );
  if (status.score > 0) {
    breakdown.status = status.score;
    matchedFields.push('status');
  }

  const time = scoreTime(analysis.time_reference, tx.timestamp, nowMs);
  if (time.score > 0) {
    breakdown.time = time.score;
    matchedFields.push('time_reference');
  }

  const counterparty = scoreCounterparty(
    analysis.counterparty_reference,
    tx.counterparty
  );
  if (counterparty.score > 0) {
    breakdown.counterparty = counterparty.score;
    matchedFields.push('counterparty_reference');
  }

  const keywords = scoreKeywords(
    analysis.important_keywords,
    `${tx.description || ''} ${tx.notes || ''}`
  );
  if (keywords.score > 0) {
    breakdown.keywords = keywords.score;
    matchedFields.push('keywords');
  }

  const confidence =
    breakdown.amount +
    breakdown.transactionType +
    breakdown.status +
    breakdown.time +
    breakdown.counterparty +
    breakdown.keywords;

  return {
    tx,
    index,
    breakdown,
    matchedFields,
    confidence,
  };
};

const compareCandidates = (a, b) => {
  // 1) Higher confidence wins.
  if (b.confidence !== a.confidence) return b.confidence - a.confidence;
  // 2) More matched fields wins.
  if (b.matchedFields.length !== a.matchedFields.length) {
    return b.matchedFields.length - a.matchedFields.length;
  }
  // 3) Stable insertion order wins.
  return a.index - b.index;
};

/**
 * Find the single most relevant transaction for a complaint analysis.
 *
 * @param {object} analysis       Output of complaintAnalysis.analyzeComplaint
 * @param {Array<object>} transactions
 * @param {object} [opts]
 * @param {number} [opts.now]     Override "now" in ms (for tests).
 * @returns {{
 *   matchedTransaction: object|null,
 *   confidence: number,
 *   matchedFields: string[],
 *   scoreBreakdown: object
 * }}
 */
const findBestMatch = (analysis, transactions, opts = {}) => {
  const result = emptyResult();
  if (!analysis || !Array.isArray(transactions) || transactions.length === 0) {
    return result;
  }

  const nowMs = typeof opts.now === 'number' ? opts.now : Date.now();

  const scored = transactions
    .map((tx, i) => scoreCandidate(analysis, tx, nowMs, i))
    .sort(compareCandidates);

  const winner = scored[0];
  const runnerUp = scored[1];

  // Threshold gate.
  if (winner.confidence < CONFIDENCE_MIN_THRESHOLD) return result;

  // Margin gate (only when more than one candidate was considered).
  if (runnerUp && winner.confidence - runnerUp.confidence < CONFIDENCE_MIN_MARGIN) {
    return result;
  }

  return {
    matchedTransaction: winner.tx,
    confidence: winner.confidence,
    matchedFields: winner.matchedFields,
    scoreBreakdown: winner.breakdown,
  };
};

module.exports = {
  findBestMatch,
  SCORE_MAX,
  WEIGHTS,
  _internals: {
    scoreCandidate,
    compareCandidates,
    emptyBreakdown,
    emptyResult,
  },
};