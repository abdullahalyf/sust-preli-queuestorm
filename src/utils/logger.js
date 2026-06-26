const config = require('../config');

const levels = ['debug', 'info', 'warn', 'error'];
const currentLevelIndex = levels.indexOf(config.logLevel);

const shouldLog = (level) => {
  const idx = levels.indexOf(level);
  return idx >= currentLevelIndex;
};

const format = (level, message, meta) => {
  const ts = new Date().toISOString();
  const base = `[${ts}] [${level.toUpperCase()}] ${message}`;
  if (meta && Object.keys(meta).length > 0) {
    return `${base} ${JSON.stringify(meta)}`;
  }
  return base;
};

const logger = {
  debug: (msg, meta) => shouldLog('debug') && console.log(format('debug', msg, meta)),
  info: (msg, meta) => shouldLog('info') && console.log(format('info', msg, meta)),
  warn: (msg, meta) => shouldLog('warn') && console.warn(format('warn', msg, meta)),
  error: (msg, meta) => shouldLog('error') && console.error(format('error', msg, meta)),
};

module.exports = logger;
