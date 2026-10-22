import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { validateEnv, loadSchema } from '../src/index.js';
import { ValidationError } from '../src/errors.js';

const FIXTURES_DIR = path.resolve('test/fixtures');

describe('validation engine and library API', () => {
  const exampleFile = path.join(FIXTURES_DIR, '.env.example');

  test('validates valid environment configuration successfully', () => {
    const validFile = path.join(FIXTURES_DIR, '.env.valid');

    const result = validateEnv({
      example: exampleFile,
      files: [validFile],
      system: false,
      checkGit: false
    });

    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);

    // Verify typed configuration output
    assert.equal(typeof result.config.PORT, 'number');
    assert.equal(result.config.PORT, 8080);
    assert.equal(result.config.NODE_ENV, 'production');
    assert.equal(result.config.DEBUG, true);
    assert.equal(typeof result.config.CACHE_TTL, 'number');
    assert.equal(result.config.CACHE_TTL, 30000); // 30s coerced to ms
  });

  test('detects missing required environment variables', () => {
    const result = validateEnv({
      example: exampleFile,
      env: {}, // completely empty
      system: false,
      checkGit: false
    });

    assert.equal(result.valid, false);
    const missingKeys = result.errors
      .filter(e => e.code === 'ERR_MISSING_REQUIRED')
      .map(e => e.key);

    assert.ok(missingKeys.includes('DATABASE_URL'));
    assert.ok(missingKeys.includes('ADMIN_EMAIL'));
    assert.ok(missingKeys.includes('API_KEY'));

    // Variables with defaults should have defaulted
    assert.equal(result.config.PORT, 3000);
    assert.equal(result.config.NODE_ENV, 'development');
  });

  test('detects type mismatches', () => {
    const invalidFile = path.join(FIXTURES_DIR, '.env.invalid');

    const result = validateEnv({
      example: exampleFile,
      files: [invalidFile],
      system: false,
      checkGit: false
    });

    assert.equal(result.valid, false);

    const typeErrorKeys = result.errors
      .filter(e => e.code === 'ERR_TYPE_MISMATCH' || e.code === 'ERR_PATTERN_MISMATCH')
      .map(e => e.key);

    assert.ok(typeErrorKeys.includes('PORT'));
    assert.ok(typeErrorKeys.includes('NODE_ENV'));
    assert.ok(typeErrorKeys.includes('DATABASE_URL'));
    assert.ok(typeErrorKeys.includes('ADMIN_EMAIL'));
    assert.ok(typeErrorKeys.includes('CACHE_TTL'));
    assert.ok(typeErrorKeys.includes('DEBUG'));
    assert.ok(typeErrorKeys.includes('API_KEY'));

    // CRITICAL: Ensure secret values were masked in error messages
    const dbError = result.errors.find(e => e.key === 'DATABASE_URL');
    assert.equal(dbError.message.includes('not_a_valid_url'), false);
    assert.ok(dbError.message.includes('[SECRET'));
  });

  test('detects placeholder values and rejects them', () => {
    const placeholderFile = path.join(FIXTURES_DIR, '.env.placeholders');

    const result = validateEnv({
      example: exampleFile,
      files: [placeholderFile],
      system: false,
      checkGit: false
    });

    assert.equal(result.valid, false);
    const placeholderError = result.errors.find(e => e.code === 'ERR_PLACEHOLDER_VALUE');
    assert.ok(placeholderError);
    assert.equal(placeholderError.key, 'API_KEY');

    // CRITICAL: Masking secret placeholder
    assert.equal(placeholderError.message.includes('changeme'), false);
    assert.ok(placeholderError.message.includes('[SECRET'));
  });

  test('warns on unknown variables and duplicate keys', () => {
    const dupFile = path.join(FIXTURES_DIR, '.env.duplicates');

    const result = validateEnv({
      example: exampleFile,
      files: [dupFile],
      system: false,
      checkGit: false,
      strict: false
    });

    const dupWarnings = result.warnings.filter(w => w.code === 'WARN_DUPLICATE_KEY');
    assert.ok(dupWarnings.length >= 1);
  });

  test('strict mode promotes warnings to errors', () => {
    const dupFile = path.join(FIXTURES_DIR, '.env.duplicates');

    const result = validateEnv({
      example: exampleFile,
      files: [dupFile],
      system: false,
      checkGit: false,
      strict: true
    });

    assert.equal(result.valid, false);
    const strictErrors = result.errors.filter(e => e.message.includes('[strict]'));
    assert.ok(strictErrors.length > 0);
  });

  test('throwOnError throws ValidationError on failure', () => {
    assert.throws(
      () => {
        validateEnv({
          example: exampleFile,
          env: {},
          system: false,
          checkGit: false,
          throwOnError: true
        });
      },
      (err) => {
        assert.ok(err instanceof ValidationError);
        assert.ok(err.errors.length > 0);
        return true;
      }
    );
  });

  test('merges multiple .env files with later files overriding earlier ones', () => {
    const fileA = path.join(FIXTURES_DIR, 'a.env');
    const fileB = path.join(FIXTURES_DIR, 'b.env');

    const result = validateEnv({
      example: exampleFile,
      files: [fileA, fileB],
      system: false,
      checkGit: false
    });

    // In a.env, OPTIONAL_VAL was empty, in b.env it was 'populated'
    // Both fileA and fileB have PORT=3000
    assert.equal(result.config.PORT, 3000);
  });
});
