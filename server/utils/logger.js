const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

class Logger {
  constructor() {
    this.logLevel = process.env.NODE_ENV === 'production' ? LogLevel.ERROR : LogLevel.DEBUG;
  }

  setLogLevel(level) {
    this.logLevel = level;
  }

  error(message, ...args) {
    if (this.logLevel >= LogLevel.ERROR) {
      console.error(`[ERROR] ${new Date().toISOString()}:`, message, ...args);
    }
  }

  warn(message, ...args) {
    if (this.logLevel >= LogLevel.WARN) {
      console.warn(`[WARN] ${new Date().toISOString()}:`, message, ...args);
    }
  }

  info(message, ...args) {
    if (this.logLevel >= LogLevel.INFO) {
      console.info(`[INFO] ${new Date().toISOString()}:`, message, ...args);
    }
  }

  debug(message, ...args) {
    if (this.logLevel >= LogLevel.DEBUG) {
      console.log(`[DEBUG] ${new Date().toISOString()}:`, message, ...args);
    }
  }
}

const logger = new Logger();

export { logger, LogLevel };