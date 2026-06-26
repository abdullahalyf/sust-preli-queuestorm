require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  apiPrefix: process.env.API_PREFIX || '/',
  logLevel: process.env.LOG_LEVEL || 'info',
};

if (config.env === 'production' && !process.env.PORT) {
  // Render requires PORT; warn if not set
  // eslint-disable-next-line no-console
  console.warn('[config] PORT not set — Render will inject it automatically.');
}

module.exports = config;
