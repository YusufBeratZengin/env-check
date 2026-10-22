import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseExampleSchema, parseJsonSchema } from '../src/schema.js';

const FIXTURES_DIR = path.resolve('test/fixtures');

describe('schema parser', () => {
  test('parses annotations from .env.example', () => {
    const exampleContent = fs.readFileSync(path.join(FIXTURES_DIR, '.env.example'), 'utf8');
    const schema = parseExampleSchema(exampleContent);

    assert.equal(schema.size, 7);

    // PORT
    const port = schema.get('PORT');
    assert.equal(port.type, 'port');
    assert.equal(port.default, '3000');
    assert.equal(port.required, false);

    // NODE_ENV
    const env = schema.get('NODE_ENV');
    assert.equal(env.type, 'enum');
    assert.deepEqual(env.enumValues, ['development', 'staging', 'production']);
    assert.equal(env.default, 'development');

    // DATABASE_URL
    const db = schema.get('DATABASE_URL');
    assert.equal(db.type, 'url');
    assert.equal(db.secret, true);
    assert.equal(db.required, true);

    // ADMIN_EMAIL
    const email = schema.get('ADMIN_EMAIL');
    assert.equal(email.type, 'email');
    assert.equal(email.required, true);

    // CACHE_TTL
    const ttl = schema.get('CACHE_TTL');
    assert.equal(ttl.type, 'duration');
    assert.equal(ttl.default, '10m');

    // DEBUG
    const debug = schema.get('DEBUG');
    assert.equal(debug.type, 'bool');
    assert.equal(debug.default, 'false');

    // API_KEY
    const apiKey = schema.get('API_KEY');
    assert.equal(apiKey.secret, true);
    assert.equal(apiKey.required, true);
    assert.ok(apiKey.pattern instanceof RegExp);
    assert.equal(apiKey.pattern.test('sk_123456abcdef'), true);
    assert.equal(apiKey.pattern.test('invalid_key'), false);
  });

  test('parses JSON schema format', () => {
    const jsonContent = fs.readFileSync(path.join(FIXTURES_DIR, 'schema.json'), 'utf8');
    const schema = parseJsonSchema(jsonContent);

    assert.equal(schema.size, 3);

    const port = schema.get('PORT');
    assert.equal(port.type, 'int');
    assert.equal(port.default, '3000');
    assert.equal(port.required, true);

    const db = schema.get('DATABASE_URL');
    assert.equal(db.type, 'url');
    assert.equal(db.secret, true);
    assert.equal(db.required, true);

    const env = schema.get('NODE_ENV');
    assert.equal(env.type, 'enum');
    assert.deepEqual(env.enumValues, ['development', 'staging', 'production']);
    assert.equal(env.required, false);
  });

  test('throws SchemaError on invalid JSON schema', () => {
    assert.throws(() => {
      parseJsonSchema('{ invalid json }');
    });
  });

  test('handles loose whitespace and optional tags in example comments', () => {
    const content = `
      #    @type    port
      #    @optional
      CUSTOM_PORT=5000
    `;
    const schema = parseExampleSchema(content);
    const custom = schema.get('CUSTOM_PORT');
    assert.equal(custom.type, 'port');
    assert.equal(custom.required, false);
    assert.equal(custom.default, '5000');
  });
});
