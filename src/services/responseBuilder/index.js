/**
 * Response Builder — composes the FINAL API response for /analyze-ticket.
 *
 * Inputs:
 *   - ticketId          (string)  — echoed from the request, never invented.
 *   - analysis          (object)  — Complaint Analysis Engine output.
 *   - matchResult       (object)  — Transaction Matcher output.
 *   - evidence          (object)  — Evidence Engine output.
 *   - decision          (object)  — Decision Engine output.
 *      { case_type, department, severity, human_review_required, reasoning }
 *
 * Output (exact official schema):
 *   {
 *     ticket_id,
 *     relevant_transaction_id,
 *     evidence_verdict,
 *     case_type,
 *     severity,
 *     department,
 *     agent_summary,
 *     recommended_next_action,
 *     customer_reply,
 *     human_review_required,
 *     confidence,    // optional
 *     reason_codes,  // optional
 *   }
 *
 * Strict rules:
 *   - Deterministic, rule-based, no LLM, no I/O, no Date.now() reads.
 *   - Customer reply NEVER promises refunds / NEVER asks for OTP / PIN /
 *     password / verification codes / account credentials.
 *   - Internal investigation logic is never leaked to the customer reply.
 *   - All enum values come from the upstream engines untouched.
 */

const { CASE_TYPE_ENUM } = require('../decisionEngine/classifier');
const { DEPARTMENT_ENUM } = require('../decisionEngine/router');
const { SEVERITY_ENUM } = require('../decisionEngine/severity');

const EVIDENCE_VERDICT_ENUM = Object.freeze([
  'consistent',
  'inconsistent',
  'insufficient_data',
]);

// --- Defensive enum guards ---
// If upstream ever returns an out-of-enum value we fall back to safe defaults
// rather than poisoning the response.
const safeEnum = (value, allowed, fallback) =>
  allowed.includes(value) ? value : fallback;

const formatAmount = (n) => {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  // Deterministic locale-free thousands separator.
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

// ---------------------------------------------------------------------------
// customer_reply
// ---------------------------------------------------------------------------
// The reply must be safe, short, and free of any credential requests. We pick
// from a small set of vetted templates based on the (case_type, evidence_verdict)
// combination. Anything ambiguous routes to a generic acknowledgement.

const buildCustomerReply = (caseType, verdict) => {
  // 1. Phishing — never mention refund, never ask for credentials, never
  //    validate anything from the customer's side. Just log it.
  if (caseType === 'phishing_or_social_engineering') {
    return (
      'Thank you for letting us know. We take account-safety reports very ' +
      'seriously and a specialist from our security team will contact you ' +
      'shortly. Please do not share any codes or passwords with anyone in ' +
      'the meantime.'
    );
  }

  // 2. Duplicate payment — acknowledge, no refund promise.
  if (caseType === 'duplicate_payment') {
    return (
      'Thank you for the details. We have logged your report about a ' +
      'duplicate charge and our team will review the affected transaction ' +
      'and follow up with you.'
    );
  }

  // 3. Wrong transfer — acknowledge the report, no recovery promise.
  if (caseType === 'wrong_transfer') {
    if (verdict === 'inconsistent') {
      return (
        'Thank you for reaching out. Our initial check on the matching ' +
        'transaction does not fully line up with the details you shared, ' +
        'so a specialist will verify the record and get back to you.'
      );
    }
    return (
      'Thank you for letting us know. We have logged your report about a ' +
      'transfer to the wrong recipient and our dispute team will review ' +
      'it and follow up.'
    );
  }

  // 4. Merchant settlement delay.
  if (caseType === 'merchant_settlement_delay') {
    if (verdict === 'consistent') {
      return (
        'Thank you. We can see the payment to the merchant and have ' +
        'forwarded your concern to the merchant operations team for ' +
        'follow-up. They will reach out with an update.'
      );
    }
    return (
      'Thank you for the details. We have logged your concern about the ' +
      'pending merchant order and our merchant operations team will ' +
      'review the case and contact you.'
    );
  }

  // 5. Agent cash-in.
  if (caseType === 'agent_cash_in_issue') {
    return (
      'Thank you for letting us know about the cash-in issue. Our agent ' +
      'operations team has been notified and will verify the transaction ' +
      'and follow up with you.'
    );
  }

  // 6. Refund request — NEVER promise a refund.
  if (caseType === 'refund_request') {
    if (verdict === 'consistent') {
      return (
        'Thank you. We have located the transaction you are referring to ' +
        'and our payments team will review your request. We will contact ' +
        'you with the next steps.'
      );
    }
    return (
      'Thank you for the details. We need a little more information to ' +
      'locate the transaction, and our payments team will reach out to ' +
      'help.'
    );
  }

  // 7. Payment failed.
  if (caseType === 'payment_failed') {
    if (verdict === 'consistent') {
      return (
        'Thank you for letting us know. We can see the failed transaction ' +
        'and our payments team will review it and contact you with the ' +
        'next steps.'
    );
    }
    if (verdict === 'inconsistent') {
      return (
        'Thank you. The transaction record shows a different status than ' +
        'what you described, so our payments team will verify the ' +
        'transaction and follow up with you.'
      );
    }
    return (
      'Thank you for the details. Our payments team will investigate the ' +
      'transaction and reach out with an update.'
    );
  }

  // 8. Default / other.
  if (verdict === 'insufficient_data') {
    return (
      'Thank you for contacting us. We have logged your report and a ' +
      'customer support specialist will reach out to gather more details ' +
      'and help resolve this.'
    );
  }
  return (
    'Thank you for contacting us. We have logged your report and will ' +
    'review it and follow up with the next steps.'
  );
};

// ---------------------------------------------------------------------------
// agent_summary
// ---------------------------------------------------------------------------
// One or two concise sentences for the support agent. References the matched
// transaction id when present so the agent can open the right record.

const buildAgentSummary = ({
  caseType,
  verdict,
  severity,
  matchedTransaction,
  analysis,
}) => {
  const txId = matchedTransaction
    ? (matchedTransaction.transaction_id ?? matchedTransaction.id ?? null)
    : null;
  const amount = formatAmount(analysis?.amount);

  const caseLabel = {
    wrong_transfer: 'wrong-transfer report',
    payment_failed: 'payment-failure report',
    refund_request: 'refund request',
    duplicate_payment: 'duplicate-payment report',
    merchant_settlement_delay: 'merchant settlement delay',
    agent_cash_in_issue: 'agent cash-in issue',
    phishing_or_social_engineering:
      'phishing / social-engineering report',
    other: 'general support request',
  }[caseType] || 'support request';

  const verdictLabel = {
    consistent: 'transaction record supports the complaint',
    inconsistent: 'transaction record contradicts the complaint',
    insufficient_data: 'transaction record could not be verified',
  }[verdict] || 'transaction record could not be verified';

  const amountPhrase = amount ? ` involving ${amount} BDT` : '';
  const txPhrase = txId ? ` Matched transaction: ${txId}.` : ' No matching transaction was found in the history.';
  const severityTag = severity ? ` Severity: ${severity}.` : '';

  return `Customer raised a ${caseLabel}${amountPhrase}; the ${verdictLabel}.${txPhrase}${severityTag}`;
};

// ---------------------------------------------------------------------------
// recommended_next_action
// ---------------------------------------------------------------------------
// One clear operational action for the support agent. Order matters: phishing
// → fraud escalation; critical/high severity → human escalation; inconsistent
// → manual verification; consistent → proceed with team-specific action;
// default → confirm details with the customer.

const buildRecommendedNextAction = ({
  caseType,
  verdict,
  severity,
  humanReviewRequired,
}) => {
  // Security first — always escalate.
  if (caseType === 'phishing_or_social_engineering') {
    return 'Escalate to Fraud Risk immediately and freeze any further account actions until reviewed.';
  }

  // Mandatory human review cases.
  if (humanReviewRequired) {
    if (caseType === 'wrong_transfer') {
      return 'Escalate to Dispute Resolution and freeze the recipient account pending investigation.';
    }
    if (caseType === 'duplicate_payment') {
      return 'Escalate to Dispute Resolution for refund eligibility review.';
    }
    return 'Escalate to the appropriate specialist team for human review.';
  }

  // Critical / high severity.
  if (severity === 'critical') {
    return 'Escalate to the relevant specialist team for immediate manual handling.';
  }
  if (severity === 'high') {
    return 'Assign to the relevant specialist team as a priority case.';
  }

  // Verdict-driven actions.
  if (verdict === 'inconsistent') {
    return 'Verify the transaction with the merchant and reconcile with the customer.';
  }
  if (verdict === 'insufficient_data') {
    return 'Request customer confirmation of transaction details (amount, recipient, time).';
  }

  // Verdict === 'consistent', medium/low severity, no human review needed.
  if (caseType === 'refund_request') {
    return 'Forward to Payments Operations for refund eligibility review.';
  }
  if (caseType === 'payment_failed') {
    return 'Forward to Payments Operations to retry or reconcile the failed transaction.';
  }
  if (caseType === 'merchant_settlement_delay') {
    return 'Forward to Merchant Operations to follow up with the merchant.';
  }
  if (caseType === 'agent_cash_in_issue') {
    return 'Forward to Agent Operations to verify the cash-in with the agent.';
  }
  if (caseType === 'wrong_transfer' || caseType === 'duplicate_payment') {
    return 'Forward to Dispute Resolution for recovery handling.';
  }

  // Default.
  return 'Request customer confirmation of the transaction details before proceeding.';
};

// ---------------------------------------------------------------------------
// reason_codes
// ---------------------------------------------------------------------------
// Short, deterministic, machine-readable labels derived from upstream signals.
// Order is fixed so consumers can rely on stable ordering.

const buildReasonCodes = ({ analysis, matchResult, evidence, decision }) => {
  const codes = [];

  // --- Match-level signals ---
  const matchedFields = Array.isArray(matchResult?.matchedFields)
    ? matchResult.matchedFields
    : [];
  if (matchedFields.includes('amount')) codes.push('AMOUNT_MATCH');
  if (matchedFields.includes('transaction_type')) codes.push('TYPE_MATCH');
  if (matchedFields.includes('status')) codes.push('STATUS_MATCH');
  if (matchedFields.includes('time_reference')) codes.push('TIME_MATCH');
  if (matchedFields.includes('counterparty_reference')) codes.push('COUNTERPARTY_MATCH');
  if (matchedFields.includes('keywords')) codes.push('KEYWORD_MATCH');

  if (!matchResult?.matchedTransaction) {
    codes.push('NO_TRANSACTION_MATCH');
  } else if (
    typeof matchResult.confidence === 'number'
    && matchResult.confidence < 50
  ) {
    codes.push('LOW_MATCH_CONFIDENCE');
  }

  // --- Evidence-level signals ---
  const verdict = evidence?.evidenceVerdict;
  if (verdict === 'inconsistent') codes.push('EVIDENCE_INCONSISTENT');
  else if (verdict === 'consistent') codes.push('EVIDENCE_CONSISTENT');
  else codes.push('EVIDENCE_INSUFFICIENT');

  const conflicting = Array.isArray(evidence?.conflictingFacts)
    ? evidence.conflictingFacts
    : [];
  if (conflicting.includes('amount')) codes.push('AMOUNT_MISMATCH');
  if (conflicting.includes('status')) codes.push('STATUS_MISMATCH');
  if (conflicting.includes('transaction_type')) codes.push('TYPE_MISMATCH');
  if (conflicting.includes('time_reference')) codes.push('TIME_MISMATCH');
  if (conflicting.includes('counterparty')) codes.push('COUNTERPARTY_MISMATCH');

  const missing = Array.isArray(evidence?.missingFacts)
    ? evidence.missingFacts
    : [];
  if (missing.includes('amount')) codes.push('AMOUNT_MISSING');
  if (missing.includes('status')) codes.push('STATUS_MISSING');

  // --- Amount-based signals (deterministic thresholds) ---
  const amt = analysis?.amount;
  if (typeof amt === 'number' && Number.isFinite(amt)) {
    if (amt >= 50000) codes.push('VERY_HIGH_VALUE_TRANSACTION');
    else if (amt >= 10000) codes.push('HIGH_VALUE_TRANSACTION');
  }

  // --- Security / fraud signals ---
  const fraud = Array.isArray(analysis?.fraud_indicators)
    ? analysis.fraud_indicators
    : [];
  const security = Array.isArray(analysis?.security_sensitive_information_mentions)
    ? analysis.security_sensitive_information_mentions
    : [];
  if (security.length > 0) codes.push('SECURITY_SENSITIVE_INFO_MENTIONED');
  if (fraud.length > 0) codes.push('FRAUD_INDICATOR_PRESENT');

  // --- Case-type flags ---
  if (decision?.case_type === 'phishing_or_social_engineering') {
    codes.push('PHISHING_CASE');
  }
  if (decision?.case_type === 'duplicate_payment') {
    codes.push('DUPLICATE_PAYMENT_CASE');
  }

  // --- Human review ---
  if (decision?.human_review_required) {
    codes.push('HUMAN_REVIEW_REQUIRED');
  }

  // De-duplicate while preserving order.
  return Array.from(new Set(codes));
};

// ---------------------------------------------------------------------------
// confidence
// ---------------------------------------------------------------------------
// Reuses matcher confidence when a transaction was matched; otherwise computes
// a deterministic fallback from evidence verdict + matched-field count.

const buildConfidence = ({ matchResult, evidence, analysis }) => {
  // Prefer matcher confidence when a transaction was selected.
  if (
    matchResult?.matchedTransaction
    && typeof matchResult.confidence === 'number'
  ) {
    // The matcher emits raw score points (max 110). Normalise to 0..1.
    // SCORE_MAX is fixed at 110 per scoring.js (50+20+15+10+5+10).
    const SCORE_MAX = 110;
    const ratio = Math.max(0, Math.min(1, matchResult.confidence / SCORE_MAX));
    return Number(ratio.toFixed(2));
  }

  // Deterministic fallback when no transaction was matched.
  const verdict = evidence?.evidenceVerdict;
  const matched = Array.isArray(evidence?.matchedFacts)
    ? evidence.matchedFacts.length
    : 0;
  const hasAmount = typeof analysis?.amount === 'number';
  const hasIntent = Boolean(analysis?.intent && analysis.intent !== 'unknown');

  let score = 0;
  if (verdict === 'consistent') score += 0.5;
  else if (verdict === 'inconsistent') score += 0.4;
  if (hasAmount) score += 0.1;
  if (hasIntent) score += 0.1;
  score += Math.min(0.3, matched * 0.1);

  return Number(Math.max(0, Math.min(1, score)).toFixed(2));
};

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * @param {{
 *   ticketId: string,
 *   analysis: object,
 *   matchResult: object,
 *   evidence: object,
 *   decision: object
 * }} input
 * @returns {object} Official response schema.
 */
const buildResponse = ({ ticketId, analysis, matchResult, evidence, decision }) => {
  const verdictRaw = evidence?.evidenceVerdict;
  const verdict = safeEnum(verdictRaw, EVIDENCE_VERDICT_ENUM, 'insufficient_data');

  const caseType = safeEnum(
    decision?.case_type,
    CASE_TYPE_ENUM,
    'other'
  );
  const department = safeEnum(
    decision?.department,
    DEPARTMENT_ENUM,
    'customer_support'
  );
  const severity = safeEnum(
    decision?.severity,
    SEVERITY_ENUM,
    'low'
  );
  const humanReviewRequired = Boolean(decision?.human_review_required);

  const matchedTransaction = matchResult?.matchedTransaction ?? null;
  // Inbound transactions may use either `transaction_id` (spec) or `id`
  // (legacy/short form). Read both, prefer the spec name.
  const relevantTransactionId = matchedTransaction
    ? (matchedTransaction.transaction_id
        ?? matchedTransaction.id
        ?? null)
    : null;

  return {
    ticket_id: ticketId,
    relevant_transaction_id: relevantTransactionId,
    evidence_verdict: verdict,
    case_type: caseType,
    severity,
    department,
    agent_summary: buildAgentSummary({
      caseType,
      verdict,
      severity,
      matchedTransaction,
      analysis,
    }),
    recommended_next_action: buildRecommendedNextAction({
      caseType,
      verdict,
      severity,
      humanReviewRequired,
    }),
    customer_reply: buildCustomerReply(caseType, verdict),
    human_review_required: humanReviewRequired,
    confidence: buildConfidence({ matchResult, evidence, analysis }),
    reason_codes: buildReasonCodes({ analysis, matchResult, evidence, decision }),
  };
};

module.exports = {
  buildResponse,
  // exported for unit testing
  _internals: {
    buildCustomerReply,
    buildAgentSummary,
    buildRecommendedNextAction,
    buildReasonCodes,
    buildConfidence,
    safeEnum,
  },
};
