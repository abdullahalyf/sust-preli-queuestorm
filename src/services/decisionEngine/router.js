/**
 * Decision Engine — department routing.
 *
 * Maps (case_type, evidence verdict, fraud/security signals) onto the
 * OFFICIAL department enum:
 *
 *   - customer_support
 *   - dispute_resolution
 *   - payments_ops
 *   - merchant_operations
 *   - agent_operations
 *   - fraud_risk
 */

const DEPARTMENT_ENUM = Object.freeze([
  'customer_support',
  'dispute_resolution',
  'payments_ops',
  'merchant_operations',
  'agent_operations',
  'fraud_risk',
]);

const routeDepartment = (caseType, evidence, analysis) => {
  const verdict = evidence?.evidenceVerdict || 'insufficient_data';
  const fraudHit = (Array.isArray(analysis?.fraud_indicators) && analysis.fraud_indicators.length > 0);
  const securityHit = (Array.isArray(analysis?.security_sensitive_information_mentions)
    && analysis.security_sensitive_information_mentions.length > 0);

  // Phishing / social engineering → fraud_risk. Always.
  if (caseType === 'phishing_or_social_engineering') {
    return {
      department: 'fraud_risk',
      reason: 'Phishing or social-engineering case is handled by the fraud risk team.',
    };
  }

  // Explicit fraud indicators on the analysis → fraud_risk, regardless of
  // case_type. Disambiguation happens upstream but fraud overrides.
  if (fraudHit || securityHit) {
    return {
      department: 'fraud_risk',
      reason: 'Fraud or security-sensitive indicators detected in the complaint.',
    };
  }

  // Wrong transfer, duplicate payment → dispute_resolution (these are
  // recovery / chargeback-style flows).
  if (caseType === 'wrong_transfer' || caseType === 'duplicate_payment') {
    return {
      department: 'dispute_resolution',
      reason: 'Wrong transfers and duplicate payments require dispute handling.',
    };
  }

  // Merchant settlement → merchant_operations.
  if (caseType === 'merchant_settlement_delay') {
    return {
      department: 'merchant_operations',
      reason: 'Merchant settlement delays are handled by merchant operations.',
    };
  }

  // Agent cash-in → agent_operations.
  if (caseType === 'agent_cash_in_issue') {
    return {
      department: 'agent_operations',
      reason: 'Agent cash-in issues are handled by agent operations.',
    };
  }

  // Failed payments, refunds, or other — payments_ops owns the rails.
  // If evidence is insufficient, route to customer_support for triage.
  if (caseType === 'payment_failed' || caseType === 'refund_request') {
    return {
      department: 'payments_ops',
      reason: 'Payment failures and refunds are handled by payments operations.',
    };
  }

  if (caseType === 'other') {
    if (verdict === 'insufficient_data') {
      return {
        department: 'customer_support',
        reason: 'Insufficient evidence — customer support will triage and gather more context.',
      };
    }
    return {
      department: 'customer_support',
      reason: 'No specialised team matched; customer support takes ownership.',
    };
  }

  // Defensive fallback (should be unreachable given the classifier).
  return {
    department: 'customer_support',
    reason: 'Default fallback to customer support.',
  };
};

module.exports = {
  routeDepartment,
  DEPARTMENT_ENUM,
};