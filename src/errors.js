/**
 * Custom error hierarchy for env-check
 */

export class EnvCheckError extends Error {
  constructor(message) {
    super(message);
    this.name = 'EnvCheckError';
  }
}

export class ValidationError extends EnvCheckError {
  /**
   * @param {string} message
   * @param {Array<{ key?: string, message: string, line?: number, code: string }>} errors
   * @param {Array<{ key?: string, message: string, code: string }>} warnings
   */
  constructor(message, errors = [], warnings = []) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
    this.warnings = warnings;
  }
}

export class SchemaError extends EnvCheckError {
  /**
   * @param {string} message
   * @param {string} [key]
   */
  constructor(message, key) {
    super(message);
    this.name = 'SchemaError';
    this.key = key;
  }
}
