/**
 * Transaction Matching Engine — public entry point.
 *
 * Inputs:
 *   - Complaint Analysis Engine output
 *       { amount, transaction_type, transaction_status_if_mentioned,
 *         time_reference, counterparty_reference, important_keywords, ... }
 *   - Array of transaction objects:
 *       { id, amount, type, status, timestamp, counterparty,
 *         description?, notes?, ... }
 *
 * Output:
 *   { matchedTransaction, confidence, matchedFields, scoreBreakdown }
 *
 * This module ONLY matches. It does NOT classify the complaint, decide
 * severity, or generate customer-facing replies.
 */

const { findBestMatch, SCORE_MAX, WEIGHTS } = require('./matcher');

/**
 * @param {object} analysis
 * @param {Array<object>} transactions
 * @param {object} [opts]
 * @returns {{
 *   matchedTransaction: object|null,
 *   confidence: number,
 *   matchedFields: string[],
 *   scoreBreakdown: object
 * }}
 */
const matchTransaction = (analysis, transactions, opts) => {
  return findBestMatch(analysis, transactions, opts);
};

module.exports = {
  matchTransaction,
  SCORE_MAX,
  WEIGHTS,
};