import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { diffEnvMaps, diffEnvFiles, formatDiff } from '../src/diff.js';

const FIXTURES_DIR = path.resolve('test/fixtures');

const FAKE_PW = 'super_' + 'secret_' + 'pw';
describe('key-only env diffing', () => {
  test('compares environment variable maps without values', () => {
    const mapA = {
      PORT: '3000',
      DATABASE_URL: 'postgres://user:' + FAKE_PW + '@localhost/db',
      REDIS_URL: 'redis://secret@localhost:6379'
    };
    const mapB = {
      PORT: '8080',
      DATABASE_URL: 'postgres://other@remote/db',
      KAFKA_BROKER: 'localhost:9092'
    };

    const diff = diffEnvMaps(mapA, mapB);

    assert.equal(diff.identical, false);
    assert.deepEqual(diff.onlyInA, ['REDIS_URL']);
    assert.deepEqual(diff.onlyInB, ['KAFKA_BROKER']);
    assert.equal(diff.common.length, 2);

    const formatted = formatDiff({
      fileA: 'a.env',
      fileB: 'b.env',
      ...diff
    });

    // CRITICAL: Ensure no sensitive values leak in the output
    assert.equal(formatted.includes(FAKE_PW), false);
    assert.equal(formatted.includes('redis://secret'), false);
    assert.equal(formatted.includes('8080'), false);
    assert.equal(formatted.includes('3000'), false);
    assert.equal(formatted.includes('REDIS_URL'), true);
    assert.equal(formatted.includes('KAFKA_BROKER'), true);
  });

  test('compares actual fixture files', () => {
    const fileA = path.join(FIXTURES_DIR, 'a.env');
    const fileB = path.join(FIXTURES_DIR, 'b.env');

    const result = diffEnvFiles(fileA, fileB);

    assert.deepEqual(result.onlyInA, ['REDIS_URL']);
    assert.deepEqual(result.onlyInB, ['KAFKA_BROKER']);
    assert.equal(result.common.find(c => c.key === 'PORT').statusA, 'set');
    assert.equal(result.common.find(c => c.key === 'OPTIONAL_VAL').statusA, 'empty');
    assert.equal(result.common.find(c => c.key === 'OPTIONAL_VAL').statusB, 'set');
  });

  test('returns identical=true for matching key sets', () => {
    const mapA = { PORT: '3000', HOST: 'localhost' };
    const mapB = { PORT: '8080', HOST: '127.0.0.1' };

    const result = diffEnvMaps(mapA, mapB);
    assert.equal(result.identical, true);
    assert.deepEqual(result.onlyInA, []);
    assert.deepEqual(result.onlyInB, []);
  });
});
