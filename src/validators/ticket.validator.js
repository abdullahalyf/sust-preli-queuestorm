/**
 * Validator for the /analyze-ticket endpoint.
 *
 * Contract:
 *   ticket_id    — required, non-empty string (echoed back in the response).
 *   complaint    — required, non-empty string (the customer's free-text issue).
 *   transactions — optional array; when present, items are loosely validated.
 *
 * The validator returns the shape consumed by middleware/validate.js:
 *   { valid: true,  data: {...} }   on success (data is forwarded to req.validated)
 *   { valid: false, errors: [...] } on failure (forwarded to errorHandler as 400)
 *
 * Pure, rule-based, no I/O. No stack traces or internal details are emitted
 * in the error response — the global error handler renders a safe payload.
 */

const trimString = (v) => (typeof v === 'string' ? v.trim() : v);

const isNonEmptyString = (v) =>
  typeof v === 'string' && v.trim().length > 0;

const isOptionalArray = (v) => v === undefined || Array.isArray(v);

const analyzeTicketSchema = {
  validate(req) {
    const body =
      (req && req.validated && req.validated.body)
      || (req && req.body)
      || {};

    const errors = [];

    // --- ticket_id: required, non-empty string ---
    const rawTicketId =
      typeof body.ticket_id === 'string'
        ? body.ticket_id
        : (typeof body.ticketId === 'string' ? body.ticketId : null);
    if (rawTicketId === null) {
      errors.push({
        field: 'ticket_id',
        message: 'ticket_id is required and must be a string.',
      });
    } else if (!isNonEmptyString(rawTicketId)) {
      errors.push({
        field: 'ticket_id',
        message: 'ticket_id must be a non-empty string.',
      });
    }

    // --- complaint: required, non-empty string ---
    const rawComplaint =
      typeof body.complaint === 'string'
        ? body.complaint
        : (typeof body.message === 'string' ? body.message : null);
    if (rawComplaint === null) {
      errors.push({
        field: 'complaint',
        message: 'complaint is required and must be a string.',
      });
    } else if (!isNonEmptyString(rawComplaint)) {
      errors.push({
        field: 'complaint',
        message: 'complaint must be a non-empty string.',
      });
    }

    // --- transactions: optional array ---
    if (!isOptionalArray(body.transactions)) {
      errors.push({
        field: 'transactions',
        message: 'transactions must be an array if provided.',
      });
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return {
      valid: true,
      data: {
        ticket_id: trimString(rawTicketId),
        complaint: trimString(rawComplaint),
        transactions: Array.isArray(body.transactions) ? body.transactions : [],
      },
    };
  },
};

module.exports = {
  analyzeTicketSchema,
};
