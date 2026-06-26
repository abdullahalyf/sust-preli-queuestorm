const config = require('../config');
const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');
const { HTTP_STATUS, ERROR_CODES } = require('../constants');

const errorHandler = (err, req, res, _next) => {
  let error = err;

  if (!(error instanceof ApiError)) {
    // Unknown / programming error — keep message generic in production
    logger.error('Unhandled error', {
      message: err.message,
      stack: err.stack,
      url: req.originalUrl,
    });

    error = new ApiError(
      HTTP_STATUS.INTERNAL_ERROR,
      config.env === 'production' ? 'Internal server error' : err.message,
      ERROR_CODES.INTERNAL,
      null
    );
  } else {
    logger.warn('Operational error', {
      code: error.code,
      message: error.message,
      url: req.originalUrl,
    });
  }

  const payload = {
    success: false,
    error: {
      code: error.code,
      message: error.message,
    },
  };

  if (error.details) {
    payload.error.details = error.details;
  }

  if (config.env !== 'production') {
    payload.error.stack = error.stack;
  }

  res.status(error.statusCode || HTTP_STATUS.INTERNAL_ERROR).json(payload);
};

module.exports = errorHandler;
