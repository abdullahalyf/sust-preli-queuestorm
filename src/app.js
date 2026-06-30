const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const config = require('./config');
const logger = require('./utils/logger');
const requestLogger = require('./middleware/requestLogger');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const apiRouter = require('./routes');

const app = express();

// --- Core security + parsing ---
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// --- Logging ---
if (config.env !== 'test') {
  app.use(morgan('combined'));
}
app.use(requestLogger);

// --- Static frontend (public/) ---
// Serves index.html, app.js, style.css. Mounted BEFORE the API router
// so GET / returns the UI. JSON metadata is exposed at /api-info.
const publicDir = path.join(__dirname, '..', 'public');
app.use(
  express.static(publicDir, {
    maxAge: '1h',
    index: 'index.html',
    extensions: ['html'],
  })
);

// --- Routes ---
app.use(config.apiPrefix, apiRouter);

// JSON metadata — moved from "/" so the UI gets the root.
app.get('/api-info', (_req, res) => {
  res.json({
    name: 'QueueStorm Investigator API',
    status: 'running',
    docs: `${config.apiPrefix}/`,
    frontend: '/',
  });
});

// --- 404 + global error handler (must be last) ---
app.use(notFound);
app.use(errorHandler);

logger.info('Express app initialized', {
  env: config.env,
  apiPrefix: config.apiPrefix,
});

module.exports = app;
