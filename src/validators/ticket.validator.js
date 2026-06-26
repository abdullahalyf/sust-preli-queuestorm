/**
 * Placeholder validator for the analyze-ticket endpoint.
 * The shape is intentionally permissive — real rules will be added
 * when the business logic is implemented.
 */
const analyzeTicketSchema = {
  validate(_req) {
    return { valid: true, data: {} };
  },
};

module.exports = {
  analyzeTicketSchema,
};
