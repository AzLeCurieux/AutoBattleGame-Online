/**
 * Professional logging utility
 * Reduces console noise and provides structured logging
 */

const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

function log(level, message, data = null) {
  // Only log INFO and DEBUG in development
  if (!isDevelopment && (level === LOG_LEVELS.INFO || level === LOG_LEVELS.DEBUG)) {
    return;
  }

  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level}]`;

  if (data) {
    console.log(`${prefix} ${message}`, JSON.stringify(data, null, 2));
  } else {
    console.log(`${prefix} ${message}`);
  }
}

module.exports = {
  LOG_LEVELS,
  log,
  error: (msg, data) => log(LOG_LEVELS.ERROR, msg, data),
  warn: (msg, data) => log(LOG_LEVELS.WARN, msg, data),
  info: (msg, data) => log(LOG_LEVELS.INFO, msg, data),
  debug: (msg, data) => log(LOG_LEVELS.DEBUG, msg, data)
};
