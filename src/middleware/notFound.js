const ApiError = require('../utils/ApiError');
const { HTTP_STATUS, ERROR_CODES } = require('../constants');

const notFound = (req, _res, next) => {
  next(
    new ApiError(
      HTTP_STATUS.NOT_FOUND,
      `Route not found: ${req.method} ${req.originalUrl}`,
      ERROR_CODES.NOT_FOUND
    )
  );
};

module.exports = notFound;
