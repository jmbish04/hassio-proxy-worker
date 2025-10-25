/**
 * @enum LogLevel
 * Defines the different levels of logging available.
 * The levels are ordered by severity, from DEBUG (least severe) to ERROR (most severe).
 */
export enum LogLevel {
  /** Detailed debug information, useful for developers. */
  DEBUG = 0,
  /** General informational messages about application state. */
  INFO = 1,
  /** Warnings about potential issues that don't prevent the app from running. */
  WARN = 2,
  /** Errors that indicate a failure or critical issue. */
  ERROR = 3,
}

/**
 * @let currentLevel
 * Stores the current logging threshold. Messages with a severity lower than this level will be ignored.
 * @type {LogLevel}
 */
let currentLevel: LogLevel = LogLevel.DEBUG;

/**
 * Determines if a log message at a given level should be processed based on the current log level.
 * @param {LogLevel} level - The severity level of the message to check.
 * @returns {boolean} - True if the message level is greater than or equal to the current level, false otherwise.
 */
function shouldLog(level: LogLevel): boolean {
  return level >= currentLevel;
}

/**
 * Converts a LogLevel enum value into its string representation.
 * @param {LogLevel} level - The log level to format.
 * @returns {string} - The string name of the log level (e.g., 'DEBUG', 'INFO'). Returns 'LOG' for unknown levels.
 */
function formatLevel(level: LogLevel): string {
  const levelNames: Record<number, string> = {
    [LogLevel.DEBUG]: 'DEBUG',
    [LogLevel.INFO]: 'INFO',
    [LogLevel.WARN]: 'WARN',
    [LogLevel.ERROR]: 'ERROR',
  };
  return levelNames[level] || 'LOG';
}

/**
 * The core logging function that formats and outputs a message to the console if it meets the current log level.
 * @param {LogLevel} level - The severity level of the log message.
 * @param {unknown[]} args - The content of the log message, which can be any number of arguments of any type.
 */
function log(level: LogLevel, ...args: unknown[]): void {
  if (!shouldLog(level)) {
    return;
  }

  const prefix = `[${formatLevel(level)}]`;
  const consoleMethods: Record<number, (...data: any[]) => void> = {
    [LogLevel.DEBUG]: console.debug,
    [LogLevel.INFO]: console.info,
    [LogLevel.WARN]: console.warn,
    [LogLevel.ERROR]: console.error,
  };

  const logMethod = consoleMethods[level] || console.log;
  logMethod(prefix, ...args);
}

/**
 * @const logger
 * The main logger object exported for use throughout the application.
 * It provides methods for logging at different levels and for setting the current log level.
 */
export const logger = {
  /**
   * Sets the minimum log level for messages to be displayed.
   * @param {LogLevel} level - The new minimum log level.
   */
  setLevel(level: LogLevel) {
    currentLevel = level;
  },

  /**
   * Logs a message at the DEBUG level.
   * @param {unknown[]} args - The content of the log message.
   */
  debug: (...args: unknown[]) => log(LogLevel.DEBUG, ...args),

  /**
   * Logs a message at the INFO level.
   * @param {unknown[]} args - The content of the log message.
   */
  info: (...args: unknown[]) => log(LogLevel.INFO, ...args),

  /**
   * Logs a message at the WARN level.
   * @param {unknown[]} args - The content of the log message.
   */
  warn: (...args: unknown[]) => log(LogLevel.WARN, ...args),

  /**
   * Logs a message at the ERROR level.
   * @param {unknown[]} args - The content of the log message.
   */
  error: (...args: unknown[]) => log(LogLevel.ERROR, ...args),
};
