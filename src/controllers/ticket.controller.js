const ticketService = require('../services/ticket.service');
const asyncHandler = require('../utils/asyncHandler');

/**
 * POST /analyze-ticket
 * Placeholder — delegates to the service layer which currently
 * returns a "not implemented" message.
 */
const analyzeTicket = asyncHandler(async (req, res) => {
  const payload = (req.validated && req.validated.body) || req.body || {};
  const result = await ticketService.analyzeTicket(payload);
  res.status(200).json(result);
});

module.exports = {
  analyzeTicket,
};
