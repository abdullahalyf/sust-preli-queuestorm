/**
 * Ticket service — final pipeline orchestrator.
 *
 * Pipeline:
 *   Complaint Analysis
 *        ↓
 *   Transaction Matcher
 *        ↓
 *   Evidence Engine
 *        ↓
 *   Decision Engine
 *        ↓
 *   Response Builder
 *
 * The four engines are invoked as opaque black boxes. This module only:
 *   - Validates the inbound payload shape.
 *   - Pipes outputs forward.
 *   - Calls the Response Builder to assemble the official schema.
 *
 * No business logic is reimplemented here. Deterministic, rule-based only.
 */

const { analyzeComplaint } = require('./complaintAnalysis');
const { matchTransaction } = require('./transactionMatcher');
const { evaluateEvidence } = require('./evidenceEngine');
const { decide } = require('./decisionEngine');
const { buildResponse } = require('./responseBuilder');

/**
 * Normalize the inbound payload.
 * Accepts both { ticket_id, complaint, transactions } and the legacy
 * { complaint } shape so older callers don't break.
 */
const normalizePayload = (payload) => {
  const p = payload && typeof payload === 'object' ? payload : {};
  return {
    ticketId:
      (typeof p.ticket_id === 'string' && p.ticket_id)
      || (typeof p.ticketId === 'string' && p.ticketId)
      || null,
    complaint:
      (typeof p.complaint === 'string' && p.complaint)
      || (typeof p.message === 'string' && p.message)
      || '',
    transactions: Array.isArray(p.transactions) ? p.transactions : [],
  };
};

/**
 * Analyze a single support ticket end-to-end and return the official
 * response schema.
 *
 * @param {object} payload  Request body — { ticket_id, complaint, transactions[] }
 * @returns {object}        Final response conforming to the official schema.
 */
const analyzeTicket = async (payload) => {
  const { ticketId, complaint, transactions } = normalizePayload(payload);

  // 1. Complaint Analysis
  const analysis = analyzeComplaint(complaint);

  // 2. Transaction Matcher
  const matchResult = matchTransaction(analysis, transactions);

  // 3. Evidence Engine
  const evidence = evaluateEvidence(analysis, matchResult);

  // 4. Decision Engine
  const decision = decide(analysis, matchResult, evidence);

  // 5. Response Builder
  return buildResponse({
    ticketId,
    analysis,
    matchResult,
    evidence,
    decision,
  });
};

module.exports = {
  analyzeTicket,
  // exported for unit testing
  _internals: {
    normalizePayload,
  },
};
