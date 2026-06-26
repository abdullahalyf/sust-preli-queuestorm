const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');

const server = app.listen(config.port, () => {
  logger.info(`Server listening on port ${config.port}`, {
    env: config.env,
  });
});

// --- Graceful shutdown ---
const shutdown = (signal) => {
  logger.info(`Received ${signal} — shutting down gracefully`);
  server.close((err) => {
    if (err) {
      logger.error('Error during shutdown', { message: err.message });
      process.exit(1);
    }
    process.exit(0);
  });

  // Force exit after 10s
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: reason && reason.message });
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { message: err.message, stack: err.stack });
  process.exit(1);
});

module.exports = server;
