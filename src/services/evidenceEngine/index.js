/**
 * Evidence Engine — public entry point.
 *
 * Inputs:
 *   - Complaint Analysis Engine output
 *   - Transaction Matcher output
 *
 * Output:
 *   {
 *     evidenceVerdict:  'consistent' | 'inconsistent' | 'insufficient_data',
 *     matchedFacts:     string[],
 *     conflictingFacts: string[],
 *     missingFacts:     string[],
 *     reasoning:        string[]
 *   }
 *
 * Deterministic. Rule-based. No LLMs. No customer reply generation. No
 * department routing. No severity calculation. Pure evaluation only.
 */

const { evaluateEvidence } = require('./evaluator');

/**
 * @param {object} analysis
 * @param {object} matchResult
 * @returns {{
 *   evidenceVerdict: string,
 *   matchedFacts: string[],
 *   conflictingFacts: string[],
 *   missingFacts: string[],
 *   reasoning: string[]
 * }}
 */
module.exports = {
  evaluateEvidence,
};