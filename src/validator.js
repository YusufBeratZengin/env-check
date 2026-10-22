/**
 * Core validation engine for environment variables against a schema.
 */

import { validateType, coerceValue } from './types.js';
import { isPlaceholder } from './placeholders.js';
import { maskSecret } from './masker.js';
import { isFileTrackedByGit } from './git.js';
import { ValidationError } from './errors.js';

/**
 * Validates environment variables against a Schema instance.
 *
 * @param {object} params
 * @param {import('./schema.js').Schema} params.schema - Parsed schema
 * @param {Record<string, string>} params.env - Merged environment variables
 * @param {Array<{ key: string, line: number, firstLine: number }>} [params.duplicates=[]] - Duplicate keys detected in files
 * @param {string[]} [params.envFiles=[]] - List of .env file paths checked
 * @param {boolean} [params.strict=false] - Treat warnings as errors
 * @param {boolean} [params.checkGit=true] - Check if .env files are tracked by Git
 * @param {boolean} [params.allowUnknown=true] - Whether unknown keys produce warnings
 * @param {boolean} [params.throwOnError=false] - Throw ValidationError on failure
 * @returns {{
 *   valid: boolean,
 *   errors: Array<{ key?: string, message: string, code: string, line?: number }>,
 *   warnings: Array<{ key?: string, message: string, code: string, line?: number }>,
 *   config: Record<string, any>,
 *   summary: { total: number, checked: number, passed: number, failed: number }
 * }}
 */
export function validateEnvironment(params) {
  const {
    schema,
    env,
    duplicates = [],
    envFiles = [],
    strict = false,
    checkGit = true,
    allowUnknown = true,
    throwOnError = false
  } = params;

  const errors = [];
  const warnings = [];
  const resolvedEnv = { ...env };
  const typedConfig = {};

  // 1. Check Git tracking for .env files
  if (checkGit && Array.isArray(envFiles)) {
    for (const file of envFiles) {
      if (isFileTrackedByGit(file)) {
        warnings.push({
          message: `File "${file}" is tracked by Git. Sensitive environment variables may be committed to version control.`,
          code: 'WARN_GIT_TRACKED'
        });
      }
    }
  }

  // 2. Check duplicate keys from parsed files
  if (Array.isArray(duplicates)) {
    for (const dup of duplicates) {
      warnings.push({
        key: dup.key,
        message: `Duplicate key "${dup.key}" found on line ${dup.line} (previously defined on line ${dup.firstLine}).`,
        code: 'WARN_DUPLICATE_KEY',
        line: dup.line
      });
    }
  }

  let checkedCount = 0;
  let passedCount = 0;

  // 3. Validate against schema
  for (const field of schema.fields.values()) {
    checkedCount++;
    const key = field.key;
    let value = resolvedEnv[key];

    // Apply default if value is missing or empty string
    if ((value === undefined || value === '') && field.default !== undefined) {
      value = field.default;
      resolvedEnv[key] = value;
    }

    // Check required
    const isMissing = value === undefined || value === '';
    if (isMissing) {
      if (field.required) {
        errors.push({
          key,
          message: `Missing required environment variable: ${key}`,
          code: 'ERR_MISSING_REQUIRED',
          line: field.line
        });
        continue;
      } else {
        // Optional missing field, skip type checking
        continue;
      }
    }

    // Check placeholder
    if (isPlaceholder(value)) {
      const displayVal = field.secret ? maskSecret(value) : `"${value}"`;
      errors.push({
        key,
        message: `Placeholder value detected for "${key}": ${displayVal}`,
        code: 'ERR_PLACEHOLDER_VALUE',
        line: field.line
      });
      continue;
    }

    // Check type
    const typeResult = validateType(value, field.type, field.enumValues);
    if (!typeResult.valid) {
      const displayVal = field.secret ? maskSecret(value) : `"${value}"`;
      errors.push({
        key,
        message: `Type mismatch for "${key}": ${typeResult.error} (received ${displayVal})`,
        code: 'ERR_TYPE_MISMATCH',
        line: field.line
      });
      continue;
    }

    // Check regex pattern
    if (field.pattern && !field.pattern.test(value)) {
      const displayVal = field.secret ? maskSecret(value) : `"${value}"`;
      errors.push({
        key,
        message: `Pattern mismatch for "${key}": value ${displayVal} does not match pattern ${field.pattern}`,
        code: 'ERR_PATTERN_MISMATCH',
        line: field.line
      });
      continue;
    }

    // Value passed all checks: coerce to native type for config
    typedConfig[key] = coerceValue(value, field.type);
    passedCount++;
  }

  // 4. Check for unknown keys (in env, but not in schema)
  if (allowUnknown) {
    for (const key of Object.keys(resolvedEnv)) {
      if (!schema.has(key)) {
        warnings.push({
          key,
          message: `Unknown environment variable "${key}" is not declared in schema.`,
          code: 'WARN_UNKNOWN_KEY'
        });
      }
    }
  }

  // If strict mode is enabled, warnings are treated as errors
  if (strict && warnings.length > 0) {
    for (const warning of warnings) {
      errors.push({
        key: warning.key,
        message: `[strict] ${warning.message}`,
        code: warning.code,
        line: warning.line
      });
    }
  }

  const valid = errors.length === 0;

  if (throwOnError && !valid) {
    const errorMessages = errors.map(e => e.message).join('\n');
    throw new ValidationError(
      `Environment validation failed with ${errors.length} error(s):\n${errorMessages}`,
      errors,
      warnings
    );
  }

  return {
    valid,
    errors,
    warnings,
    config: typedConfig,
    summary: {
      total: schema.size,
      checked: checkedCount,
      passed: passedCount,
      failed: errors.length
    }
  };
}
