/**
 * Validation middleware factory.
 * Usage:
 *   router.post('/x', validate(analyzeTicketSchema), controller);
 *
 * `schema` is expected to expose a `validate(req)` method that returns
 * either { valid: true, data } or { valid: false, errors }.
 *
 * Replace the placeholder implementation with Joi / Zod / express-validator
 * without changing the controller wiring.
 */
const ApiError = require('../utils/ApiError');
const { HTTP_STATUS, ERROR_CODES } = require('../constants');

const validate = (schema) => (req, _res, next) => {
  if (!schema || typeof schema.validate !== 'function') {
    return next();
  }

  const result = schema.validate(req);
  if (result && result.valid) {
    if (result.data) {
      req.validated = { ...(req.validated || {}), ...result.data };
    }
    return next();
  }

  return next(
    new ApiError(
      HTTP_STATUS.BAD_REQUEST,
      'Invalid request payload',
      ERROR_CODES.VALIDATION_ERROR,
      (result && result.errors) || ['Validation failed']
    )
  );
};

module.exports = validate;
