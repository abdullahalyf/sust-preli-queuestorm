const express = require('express');
const { analyzeTicket } = require('../controllers/ticket.controller');
const validate = require('../middleware/validate');
const { analyzeTicketSchema } = require('../validators/ticket.validator');

const router = express.Router();

router.post('/analyze-ticket', validate(analyzeTicketSchema), analyzeTicket);

module.exports = router;
