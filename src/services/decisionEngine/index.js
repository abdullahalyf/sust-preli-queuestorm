/**
 * Decision Engine — public entry point.
 *
 * Inputs:
 *   - Complaint Analysis Engine output (analysis)
 *   - Transaction Matcher output       (matchResult)
 *   - Evidence Engine output           (evidence)
 *
 * Output:
 *   {
 *     case_type,
 *     department,
 *     severity,
 *     human_review_required,
 *     reasoning: string[]
 *   }
 *
 * Deterministic. Rule-based. No LLMs. Severity, department, and case_type
 * are restricted to the official enums (exported below for downstream
 * validation).
 */

const { classifyCase, CASE_TYPE_ENUM } = require('./classifier');
const { routeDepartment, DEPARTMENT_ENUM } = require('./router');
const { computeSeverity, SEVERITY_ENUM } = require('./severity');

const DEFAULT_RESULT = () => ({
  case_type: 'other',
  department: 'customer_support',
  severity: 'low',
  human_review_required: true,
  reasoning: ['Insufficient inputs to make a deterministic decision.'],
});

/**
 * Cases that always require a human:
 *   - critical severity
 *   - phishing / social engineering
 *   - insufficient evidence (so a human can gather more context)
 */
const requiresHumanReview = (caseType, severity, evidence) => {
  if (severity === 'critical') return true;
  if (caseType === 'phishing_or_social_engineering') return true;
  if (evidence?.evidenceVerdict === 'insufficient_data') return true;
  return false;
};

/**
 * @param {object} analysis
 * @param {object} matchResult
 * @param {object} evidence
 * @returns {{
 *   case_type: string,
 *   department: string,
 *   severity: string,
 *   human_review_required: boolean,
 *   reasoning: string[]
 * }}
 */
const decide = (analysis, matchResult, evidence) => {
  if (!analysis) return DEFAULT_RESULT();

  const { case_type, signals: classifierSignals } = classifyCase(
    analysis,
    matchResult,
    evidence
  );

  const { department, reason: departmentReason } = routeDepartment(
    case_type,
    evidence,
    analysis
  );

  const { severity, reason: severityReason } = computeSeverity(
    case_type,
    analysis,
    evidence
  );

  const human_review_required = requiresHumanReview(case_type, severity, evidence);

  // Assemble reasoning: every signal and every decision rule, in order.
  const reasoning = [];

  for (const sig of classifierSignals) {
    reasoning.push(`${describeCase(case_type)}: ${sig.reason}`);
  }

  // Evidence summary (one line).
  const verdict = evidence?.evidenceVerdict || 'insufficient_data';
  if (verdict === 'consistent') {
    reasoning.push('Evidence supports the complaint.');
  } else if (verdict === 'inconsistent') {
    reasoning.push('Evidence contradicts the complaint.');
  } else {
    reasoning.push('Insufficient evidence to verify the complaint.');
  }

  reasoning.push(`${describeDepartment(department)}: ${departmentReason}`);
  reasoning.push(`Severity set to ${severity}: ${severityReason}.`);

  if (human_review_required) {
    reasoning.push('Human review is required for this case.');
  } else {
    reasoning.push('Human review is not required.');
  }

  return {
    case_type,
    department,
    severity,
    human_review_required,
    reasoning,
  };
};

const describeCase = (c) => {
  const map = {
    wrong_transfer: 'Case classified as wrong_transfer',
    payment_failed: 'Case classified as payment_failed',
    refund_request: 'Case classified as refund_request',
    duplicate_payment: 'Case classified as duplicate_payment',
    merchant_settlement_delay: 'Case classified as merchant_settlement_delay',
    agent_cash_in_issue: 'Case classified as agent_cash_in_issue',
    phishing_or_social_engineering: 'Case classified as phishing_or_social_engineering',
    other: 'Case classified as other',
  };
  return map[c] || `Case classified as ${c}`;
};

const describeDepartment = (d) => {
  const map = {
    customer_support: 'Routed to Customer Support',
    dispute_resolution: 'Routed to Dispute Resolution',
    payments_ops: 'Routed to Payments Operations',
    merchant_operations: 'Routed to Merchant Operations',
    agent_operations: 'Routed to Agent Operations',
    fraud_risk: 'Routed to Fraud Risk',
  };
  return map[d] || `Routed to ${d}`;
};

module.exports = {
  decide,
  CASE_TYPE_ENUM,
  DEPARTMENT_ENUM,
  SEVERITY_ENUM,
};