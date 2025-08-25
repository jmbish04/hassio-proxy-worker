export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

let currentLevel: LogLevel = LogLevel.DEBUG;

function shouldLog(level: LogLevel) {
  return level >= currentLevel;
}

function formatLevel(level: LogLevel): string {
  switch (level) {
    case LogLevel.DEBUG:
      return 'DEBUG';
    case LogLevel.INFO:
      return 'INFO';
    case LogLevel.WARN:
      return 'WARN';
    case LogLevel.ERROR:
      return 'ERROR';
    default:
      return 'LOG';
  }
}

function log(level: LogLevel, ...args: unknown[]) {
  if (!shouldLog(level)) {
    return;
  }
  const prefix = `[${formatLevel(level)}]`;
  switch (level) {
    case LogLevel.DEBUG:
      console.debug(prefix, ...args);
      break;
    case LogLevel.INFO:
      console.info(prefix, ...args);
      break;
    case LogLevel.WARN:
      console.warn(prefix, ...args);
      break;
    case LogLevel.ERROR:
      console.error(prefix, ...args);
      break;
    default:
      console.log(prefix, ...args);
  }
}

export const logger = {
  setLevel(level: LogLevel) {
    currentLevel = level;
  },
  debug: (...args: unknown[]) => log(LogLevel.DEBUG, ...args),
  info: (...args: unknown[]) => log(LogLevel.INFO, ...args),
  warn: (...args: unknown[]) => log(LogLevel.WARN, ...args),
  error: (...args: unknown[]) => log(LogLevel.ERROR, ...args),
};
