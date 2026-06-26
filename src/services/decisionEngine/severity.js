/**
 * Decision Engine — severity scoring.
 *
 * Maps (case_type, amount, evidence verdict, fraud/security signals) onto
 * the OFFICIAL severity enum:
 *
 *   - low
 *   - medium
 *   - high
 *   - critical
 *
 * Rules (in priority order):
 *   1. critical: phishing/fraud case, OR security-sensitive mentions, OR
 *      multiple critical-field conflicts in evidence, OR a very-high
 *      amount case (≥ VERY_HIGH_AMOUNT_THRESHOLD).
 *   2. high: wrong transfer, duplicate payment, or high-amount (≥ HIGH)
 *      payment failure / refund request.
 *   3. medium: refund, merchant settlement delay.
 *   4. low: everything else.
 */

const SEVERITY_ENUM = Object.freeze(['low', 'medium', 'high', 'critical']);

const { HIGH_AMOUNT_THRESHOLD, VERY_HIGH_AMOUNT_THRESHOLD } = require('./classifier');

const toNumber = (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[, ]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const computeSeverity = (caseType, analysis, evidence) => {
  const amount = toNumber(analysis?.amount);
  const verdict = evidence?.evidenceVerdict || 'insufficient_data';
  const conflicting = Array.isArray(evidence?.conflictingFacts) ? evidence.conflictingFacts : [];
  const fraudHit = (Array.isArray(analysis?.fraud_indicators) && analysis.fraud_indicators.length > 0);
  const securityHit = (Array.isArray(analysis?.security_sensitive_information_mentions)
    && analysis.security_sensitive_information_mentions.length > 0);

  // --- critical ---
  if (caseType === 'phishing_or_social_engineering') {
    return {
      severity: 'critical',
      reason: 'Phishing or social-engineering case is always critical.',
    };
  }
  if (fraudHit || securityHit) {
    return {
      severity: 'critical',
      reason: 'Fraud or security-sensitive indicators detected.',
    };
  }
  // Multiple critical-field conflicts (amount + status disagreement).
  if (
    conflicting.includes('amount') && conflicting.includes('status')
  ) {
    return {
      severity: 'critical',
      reason: 'Evidence has multiple critical contradictions (amount and status).',
    };
  }
  if (amount !== null && amount >= VERY_HIGH_AMOUNT_THRESHOLD) {
    return {
      severity: 'critical',
      reason: `Transaction amount (${amount}) is very high.`,
    };
  }

  // --- high ---
  if (caseType === 'wrong_transfer' || caseType === 'duplicate_payment') {
    return {
      severity: 'high',
      reason: 'Wrong transfer or duplicate payment is high severity.',
    };
  }
  if (
    amount !== null && amount >= HIGH_AMOUNT_THRESHOLD
    && (caseType === 'payment_failed' || caseType === 'refund_request')
  ) {
    return {
      severity: 'high',
      reason: `High-value (${amount}) payment failure or refund requires urgent attention.`,
    };
  }

  // --- medium ---
  if (caseType === 'refund_request' || caseType === 'merchant_settlement_delay') {
    return {
      severity: 'medium',
      reason: 'Refund requests and merchant settlement delays are medium severity.',
    };
  }

  // --- low (everything else) ---
  // Down-weight insufficient_data to low when no strong signal is present.
  if (verdict === 'insufficient_data') {
    return {
      severity: 'low',
      reason: 'Insufficient evidence and no strong signals — default to low.',
    };
  }
  return {
    severity: 'low',
    reason: 'No severity-escalating signals detected.',
  };
};

module.exports = {
  computeSeverity,
  SEVERITY_ENUM,
};