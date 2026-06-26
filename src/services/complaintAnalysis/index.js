/**
 * Complaint Analysis Engine
 *
 * Public entry point. Combines preprocessing (normalization) and
 * structured parsing. Designed to be reused by later modules.
 *
 * Input  : a complaint text string (English / Bangla / Banglish)
 * Output : a structured object (see parser.js for the exact shape)
 *
 * This module ONLY extracts. It does NOT classify, route, score,
 * or decide severity.
 */

const { normalize } = require('./normalizer');
const { parse } = require('./parser');

/**
 * Analyze a complaint.
 *
 * @param {string} complaintText  Raw customer complaint.
 * @returns {{
 *   normalized_text: string,
 *   intent: string|null,
 *   amount: number|null,
 *   transaction_type: string|null,
 *   transaction_status_if_mentioned: string|null,
 *   time_reference: string|null,
 *   counterparty_reference: string|null,
 *   refund_requested: boolean,
 *   fraud_indicators: string[],
 *   security_sensitive_information_mentions: string[],
 *   language: 'en'|'bn'|'banglish',
 *   important_keywords: string[]
 * }}
 */
const analyzeComplaint = (complaintText) => {
  const normalized = normalize(complaintText);
  const parsed = parse(complaintText, normalized);
  return {
    normalized_text: normalized,
    ...parsed,
  };
};

module.exports = {
  analyzeComplaint,
};