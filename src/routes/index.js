const express = require('express');
const config = require('../config');

const healthRoutes = require('./health.routes');
const ticketRoutes = require('./ticket.routes');

const router = express.Router();

router.use(healthRoutes);
router.use(ticketRoutes);

router.get('/', (_req, res) => {
  res.json({
    name: 'QueueStorm Investigator API',
    version: '1.0.0',
    prefix: config.apiPrefix,
    endpoints: ['/health', '/analyze-ticket'],
  });
});

module.exports = router;
