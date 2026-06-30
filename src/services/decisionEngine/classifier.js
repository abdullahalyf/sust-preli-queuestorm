/**
 * Decision Engine — case classification.
 *
 * Maps (analysis, matchResult, evidence) onto the OFFICIAL case_type enum:
 *
 *   - wrong_transfer
 *   - payment_failed
 *   - refund_request
 *   - duplicate_payment
 *   - merchant_settlement_delay
 *   - agent_cash_in_issue
 *   - phishing_or_social_engineering
 *   - other
 *
 * Deterministic, rule-based. Order matters: phishing > duplicate > wrong
 * transfer > merchant settlement > agent cash-in > refund > payment failed
 * > other. The classifier also emits a `signals` array describing which
 * rules fired, consumed by severity.js / router.js / reasoning.
 */

const CASE_TYPE_ENUM = Object.freeze([
  'wrong_transfer',
  'payment_failed',
  'refund_request',
  'duplicate_payment',
  'merchant_settlement_delay',
  'agent_cash_in_issue',
  'phishing_or_social_engineering',
  'other',
]);

// High-amount threshold for severity / human-review gating. BDT.
const HIGH_AMOUNT_THRESHOLD = 10000;
const VERY_HIGH_AMOUNT_THRESHOLD = 50000;

// Indicators we look for in the analysis. Analysis fields: intent,
// fraud_indicators, security_sensitive_information_mentions, important_keywords.
const PHISHING_KEYWORDS = [
  'otp', 'pin', 'cvv', 'password', 'one time password', 'verification code',
  'phishing', 'social engineering', 'share otp', 'shared otp', 'asked for otp',
];

const DUPLICATE_KEYWORDS = [
  'twice', 'double charged', 'charged twice', 'deducted twice', 'two times',
  'double', 'duplicate payment', 'duplicate charge', 'dobbar', 'দুইবার', 'দ্বিগুণ',
];

const classifyCase = (analysis, matchResult, evidence) => {
  const signals = [];

  const intent = analysis?.intent || null;
  const fraudIndicators = Array.isArray(analysis?.fraud_indicators) ? analysis.fraud_indicators : [];
  const securityMentions = Array.isArray(analysis?.security_sensitive_information_mentions)
    ? analysis.security_sensitive_information_mentions
    : [];
  const important = Array.isArray(analysis?.important_keywords) ? analysis.important_keywords : [];
  const matchedFields = Array.isArray(matchResult?.matchedFields) ? matchResult.matchedFields : [];

  // --- 1. Phishing / social engineering ---
  // Triggered when the complaint mentions security-sensitive info (OTP/PIN)
  // OR explicit phishing/social-engineering keywords. This case wins over
  // every other classification because security events are highest-stakes.
  const phishingHit = securityMentions.length > 0
    || important.some((k) => PHISHING_KEYWORDS.includes(k));
  if (phishingHit) {
    signals.push({
      rule: 'phishing_or_social_engineering',
      reason: 'Customer mentions security-sensitive information (e.g. OTP, PIN) or phishing keywords.',
    });
    return { case_type: 'phishing_or_social_engineering', signals };
  }

  // --- 2. Duplicate payment ---
  // Triggered when the complaint mentions being charged twice / duplicate
  // indicators. Independent of intent, since the engine also has to catch
  // "I sent 5000 twice" without the user calling it a duplicate explicitly.
  const duplicateHit = DUPLICATE_KEYWORDS.some((k) => important.includes(k))
    || important.some((k) => DUPLICATE_KEYWORDS.includes(k));
  if (duplicateHit) {
    signals.push({
      rule: 'duplicate_payment',
      reason: 'Customer reports being charged or paying more than once.',
    });
    return { case_type: 'duplicate_payment', signals };
  }

  // --- 3. Wrong transfer ---
  if (intent === 'wrong_transfer') {
    signals.push({ rule: 'wrong_transfer', reason: 'Complaint intent indicates a transfer sent to the wrong recipient.' });
    return { case_type: 'wrong_transfer', signals };
  }

  // --- 4. Merchant settlement delay ---
  // Counterparty looks like a merchant and the customer reports they paid
  // for goods/services they did not receive.
  const counterparty = (analysis?.counterparty_reference || '').toLowerCase();
  const typeIsPayment = (analysis?.transaction_type || '').toLowerCase() === 'payment';
  const noProductHints = important.some((k) =>
    [
      'product', 'goods', 'service', 'order', 'delivery', 'not received',
      'settlement', 'merchant settlement', 'settlement pending',
      'merchant payment pending',
    ].includes(k));
  if (
    (counterparty.includes('merchant') || typeIsPayment)
    && noProductHints
  ) {
    signals.push({
      rule: 'merchant_settlement_delay',
      reason: 'Customer reports paying a merchant without receiving goods or services.',
    });
    return { case_type: 'merchant_settlement_delay', signals };
  }

  // --- 5. Agent cash-in issue ---
  if (
    intent === 'cash_in_problem'
    || (analysis?.transaction_type === 'cash_in')
    || counterparty.includes('agent')
  ) {
    signals.push({
      rule: 'agent_cash_in_issue',
      reason: 'Complaint relates to a cash-in or agent-top-up problem.',
    });
    return { case_type: 'agent_cash_in_issue', signals };
  }

  // --- 6. Refund request ---
  if (intent === 'refund_request' || analysis?.refund_requested === true) {
    signals.push({
      rule: 'refund_request',
      reason: 'Customer explicitly requested a refund.',
    });
    return { case_type: 'refund_request', signals };
  }

  // --- 7. Payment failed ---
  if (
    intent === 'failed_payment'
    || intent === 'payment_reversal'
    || analysis?.transaction_status_if_mentioned === 'failed'
  ) {
    signals.push({
      rule: 'payment_failed',
      reason: 'Complaint indicates a failed or stuck payment that the customer needs resolved.',
    });
    return { case_type: 'payment_failed', signals };
  }

  // --- 8. Other / unknown ---
  signals.push({
    rule: 'other',
    reason: 'Complaint did not match any specific case pattern; routing to general support.',
  });
  return { case_type: 'other', signals };
};

module.exports = {
  classifyCase,
  CASE_TYPE_ENUM,
  HIGH_AMOUNT_THRESHOLD,
  VERY_HIGH_AMOUNT_THRESHOLD,
};