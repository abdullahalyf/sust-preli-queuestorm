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

// --- Routes ---
app.use(config.apiPrefix, apiRouter);

// Root
app.get('/', (_req, res) => {
  res.json({
    name: 'QueueStorm Investigator API',
    status: 'running',
    docs: `${config.apiPrefix}/`,
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
