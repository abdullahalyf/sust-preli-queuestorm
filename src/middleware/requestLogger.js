const logger = require('../utils/logger');

const requestLogger = (req, res, next) => {
  const start = Date.now();
  const { method, originalUrl, ip } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP request', {
      method,
      url: originalUrl,
      status: res.statusCode,
      durationMs: duration,
      ip,
    });
  });

  next();
};

module.exports = requestLogger;
