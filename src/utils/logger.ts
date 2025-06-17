export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;

  private constructor() {
    this.logLevel = process.env.NODE_ENV === 'production' ? LogLevel.ERROR : LogLevel.DEBUG;
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  error(message: string, ...args: (string | number | boolean | object | Error | null | undefined)[]): void {
    if (this.logLevel >= LogLevel.ERROR) {
      console.error(`[ERROR] ${new Date().toISOString()}:`, message, ...args);
    }
  }

  warn(message: string, ...args: (string | number | boolean | object | Error | null | undefined)[]): void {
    if (this.logLevel >= LogLevel.WARN) {
      console.warn(`[WARN] ${new Date().toISOString()}:`, message, ...args);
    }
  }

  info(message: string, ...args: (string | number | boolean | object | Error | null | undefined)[]): void {
    if (this.logLevel >= LogLevel.INFO) {
      console.info(`[INFO] ${new Date().toISOString()}:`, message, ...args);
    }
  }

  debug(message: string, ...args: (string | number | boolean | object | Error | null | undefined)[]): void {
    if (this.logLevel >= LogLevel.DEBUG) {
      console.log(`[DEBUG] ${new Date().toISOString()}:`, message, ...args);
    }
  }
}

export const logger = Logger.getInstance();