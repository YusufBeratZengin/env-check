/**
 * env-check: Validate environment variables and .env files against a schema without leaking secrets.
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseDotenv, expandVariables } from './parser.js';
import { parseExampleSchema, parseJsonSchema, Schema } from './schema.js';
import { validateEnvironment } from './validator.js';
import { maskSecret, maskValue, isLikelySecret } from './masker.js';
import { diffEnvFiles, diffEnvMaps, formatDiff } from './diff.js';
import { generateExample, inferType } from './generator.js';
import { isFileTrackedByGit } from './git.js';
import { isPlaceholder } from './placeholders.js';
import { validateType, coerceValue, parseTypeDefinition } from './types.js';
import { EnvCheckError, ValidationError, SchemaError } from './errors.js';

/**
 * Loads a schema from either a .env.example file or a JSON schema file.
 *
 * @param {string} filePath - Path to .env.example or schema.json
 * @returns {Schema}
 */
export function loadSchema(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new SchemaError(`Schema file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  if (filePath.endsWith('.json')) {
    return parseJsonSchema(content);
  }
  return parseExampleSchema(content);
}

/**
 * Loads and merges environment variables from files and/or process.env.
 *
 * @param {object} [options]
 * @param {string|string[]} [options.files=['.env']] - .env files to load
 * @param {boolean} [options.system=true] - Whether to merge process.env
 * @param {boolean} [options.expand=false] - Whether to expand ${VAR}
 * @param {string} [options.cwd=process.cwd()] - Working directory
 * @returns {{
 *   env: Record<string, string>,
 *   duplicates: Array<{ key: string, line: number, firstLine: number, file: string }>,
 *   loadedFiles: string[]
 * }}
 */
export function loadEnv(options = {}) {
  const {
    files = ['.env'],
    system = true,
    expand = false,
    cwd = process.cwd()
  } = options;

  const fileList = Array.isArray(files) ? files : [files];
  /** @type {Record<string, string>} */
  const mergedEnv = {};
  const allDuplicates = [];
  const loadedFiles = [];

  for (const relativePath of fileList) {
    const fullPath = path.resolve(cwd, relativePath);
    if (fs.existsSync(fullPath)) {
      loadedFiles.push(relativePath);
      const content = fs.readFileSync(fullPath, 'utf8');
      const { parsed, duplicates } = parseDotenv(content, {
        expand,
        context: mergedEnv
      });

      for (const dup of duplicates) {
        allDuplicates.push({ ...dup, file: relativePath });
      }

      Object.assign(mergedEnv, parsed);
    }
  }

  if (system && typeof process !== 'undefined' && process.env) {
    // process.env takes precedence or supplements
    Object.assign(mergedEnv, process.env);
  }

  return {
    env: mergedEnv,
    duplicates: allDuplicates,
    loadedFiles
  };
}

/**
 * Validates environment variables against a schema.
 * Main entry point for application startup validation returning typed config.
 *
 * @param {object} [options]
 * @param {Schema|string} [options.schema] - Schema instance or path to schema file
 * @param {string} [options.example] - Path to .env.example file (default: '.env.example' if exists)
 * @param {string} [options.schemaFile] - Path to env.schema.json
 * @param {string|string[]} [options.files] - .env files to load
 * @param {Record<string, string>} [options.env] - Pre-loaded environment object
 * @param {boolean} [options.system=true] - Include process.env
 * @param {boolean} [options.strict=false] - Treat warnings as errors
 * @param {boolean} [options.expand=false] - Expand ${VAR} syntax
 * @param {boolean} [options.checkGit=true] - Check if .env files are tracked by Git
 * @param {boolean} [options.throwOnError=false] - Throw ValidationError on failure
 * @param {string} [options.cwd=process.cwd()] - Working directory
 * @returns {{
 *   valid: boolean,
 *   errors: Array<{ key?: string, message: string, code: string, line?: number }>,
 *   warnings: Array<{ key?: string, message: string, code: string, line?: number }>,
 *   config: Record<string, any>,
 *   summary: { total: number, checked: number, passed: number, failed: number }
 * }}
 */
export function validateEnv(options = {}) {
  const {
    schema: schemaInput,
    example = '.env.example',
    schemaFile,
    files = ['.env'],
    env: manualEnv,
    system = true,
    strict = false,
    expand = false,
    checkGit = true,
    throwOnError = false,
    cwd = process.cwd()
  } = options;

  // Resolve Schema
  let schema;
  if (schemaInput instanceof Schema) {
    schema = schemaInput;
  } else if (typeof schemaInput === 'string') {
    schema = loadSchema(path.resolve(cwd, schemaInput));
  } else if (schemaFile) {
    schema = loadSchema(path.resolve(cwd, schemaFile));
  } else {
    const examplePath = path.resolve(cwd, example);
    if (!fs.existsSync(examplePath)) {
      throw new SchemaError(`Schema file not found. Expected "${example}" or specify schemaFile.`);
    }
    schema = loadSchema(examplePath);
  }

  // Resolve Environment variables
  let targetEnv;
  let duplicates = [];
  let loadedFiles = [];

  if (manualEnv && typeof manualEnv === 'object') {
    targetEnv = { ...manualEnv };
  } else {
    const loaded = loadEnv({
      files,
      system,
      expand,
      cwd
    });
    targetEnv = loaded.env;
    duplicates = loaded.duplicates;
    loadedFiles = loaded.loadedFiles;
  }

  return validateEnvironment({
    schema,
    env: targetEnv,
    duplicates,
    envFiles: loadedFiles,
    strict,
    checkGit,
    throwOnError
  });
}

// Re-exports
export {
  parseDotenv,
  expandVariables,
  parseExampleSchema,
  parseJsonSchema,
  Schema,
  validateEnvironment,
  maskSecret,
  maskValue,
  isLikelySecret,
  diffEnvFiles,
  diffEnvMaps,
  formatDiff,
  generateExample,
  inferType,
  isFileTrackedByGit,
  isPlaceholder,
  validateType,
  coerceValue,
  parseTypeDefinition,
  EnvCheckError,
  ValidationError,
  SchemaError
};
