module.exports = {
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    NOT_FOUND: 404,
    UNPROCESSABLE: 422,
    INTERNAL_ERROR: 500,
  },
  ERROR_CODES: {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    INTERNAL: 'INTERNAL_ERROR',
  },
  ENV: {
    DEVELOPMENT: 'development',
    PRODUCTION: 'production',
    TEST: 'test',
  },
};
