import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadEnv, loadSchema, validateEnv, SchemaError } from '../src/index.js';

test('loadEnv handles a single path and skips absent files', () => {
  const loaded = loadEnv({ files: 'docs/demo.env', system: false });
  assert.equal(loaded.env.PORT, '3000');
  assert.deepEqual(loaded.loadedFiles, ['docs/demo.env']);
  assert.deepEqual(loadEnv({ files: ['docs/missing.env'], system: false }).loadedFiles, []);
});

test('system values take precedence over files', t => {
  const previous = process.env.PORT;
  t.after(() => {
    if (previous === undefined) delete process.env.PORT;
    else process.env.PORT = previous;
  });
  process.env.PORT = '9090';
  assert.equal(loadEnv({ files: 'docs/demo.env' }).env.PORT, '9090');
  assert.equal(loadEnv({ files: 'docs/demo.env', system: false }).env.PORT, '3000');
});

test('schema paths and parsed schemas both return typed results', () => {
  for (const schema of ['docs/env.schema.json', loadSchema('docs/env.schema.json')]) {
    const result = validateEnv({ schema, files: 'docs/demo.env', system: false, checkGit: false });
    assert.equal(result.valid, true);
    assert.equal(result.config.PORT, 3000);
    assert.equal(result.config.DEBUG, false);
  }
});

test('missing schema paths fail with SchemaError rather than empty validation', () => {
  assert.throws(() => loadSchema('docs/missing.json'), SchemaError);
  assert.throws(() => validateEnv({ example: 'docs/missing.env', env: {} }), SchemaError);
});
