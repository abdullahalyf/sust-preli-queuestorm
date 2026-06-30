const express = require('express');
const config = require('../config');

const healthRoutes = require('./health.routes');
const ticketRoutes = require('./ticket.routes');

const router = express.Router();

router.use(healthRoutes);
router.use(ticketRoutes);

// NOTE: GET / is intentionally NOT handled here. The frontend at public/index.html
// is served by express.static mounted earlier in src/app.js, so the UI owns "/".
// A JSON metadata fallback is exposed at GET /api-info for programmatic clients.
router.get('/', (_req, res) => {
  res.redirect(302, '/api-info');
});

module.exports = router;
