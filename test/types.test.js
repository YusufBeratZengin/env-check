import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateType,
  coerceValue,
  parseTypeDefinition,
  parseDurationToMs
} from '../src/types.js';

describe('type validation and coercion', () => {
  describe('parseTypeDefinition', () => {
    test('parses simple types and aliases', () => {
      assert.deepEqual(parseTypeDefinition('int'), { type: 'int' });
      assert.deepEqual(parseTypeDefinition('integer'), { type: 'int' });
      assert.deepEqual(parseTypeDefinition('bool'), { type: 'bool' });
      assert.deepEqual(parseTypeDefinition('boolean'), { type: 'bool' });
      assert.deepEqual(parseTypeDefinition('port'), { type: 'port' });
      assert.deepEqual(parseTypeDefinition('url'), { type: 'url' });
      assert.deepEqual(parseTypeDefinition('email'), { type: 'email' });
      assert.deepEqual(parseTypeDefinition('duration'), { type: 'duration' });
      assert.deepEqual(parseTypeDefinition('string'), { type: 'string' });
    });

    test('parses enum definitions', () => {
      assert.deepEqual(parseTypeDefinition('enum(development, staging, production)'), {
        type: 'enum',
        enumValues: ['development', 'staging', 'production']
      });
      assert.deepEqual(parseTypeDefinition('enum(a,b,c)'), {
        type: 'enum',
        enumValues: ['a', 'b', 'c']
      });
    });
  });

  describe('validateType', () => {
    test('validates int', () => {
      assert.equal(validateType('123', 'int').valid, true);
      assert.equal(validateType('-456', 'int').valid, true);
      assert.equal(validateType('0', 'int').valid, true);
      assert.equal(validateType('12.34', 'int').valid, false);
      assert.equal(validateType('abc', 'int').valid, false);
    });

    test('validates port', () => {
      assert.equal(validateType('80', 'port').valid, true);
      assert.equal(validateType('3000', 'port').valid, true);
      assert.equal(validateType('65535', 'port').valid, true);
      assert.equal(validateType('0', 'port').valid, false);
      assert.equal(validateType('65536', 'port').valid, false);
      assert.equal(validateType('-1', 'port').valid, false);
      assert.equal(validateType('port', 'port').valid, false);
    });

    test('validates bool', () => {
      for (const val of ['true', 'false', '1', '0', 'yes', 'no', 'TRUE', 'FALSE']) {
        assert.equal(validateType(val, 'bool').valid, true, `Expected ${val} to be valid`);
      }
      assert.equal(validateType('maybe', 'bool').valid, false);
      assert.equal(validateType('2', 'bool').valid, false);
    });

    test('validates enum', () => {
      const allowed = ['dev', 'stage', 'prod'];
      assert.equal(validateType('dev', 'enum', allowed).valid, true);
      assert.equal(validateType('prod', 'enum', allowed).valid, true);
      assert.equal(validateType('unknown', 'enum', allowed).valid, false);
    });

    test('validates email', () => {
      assert.equal(validateType('test@example.com', 'email').valid, true);
      assert.equal(validateType('user.name+tag@domain.co.uk', 'email').valid, true);
      assert.equal(validateType('not-an-email', 'email').valid, false);
      assert.equal(validateType('@example.com', 'email').valid, false);
    });

    test('validates url', () => {
      assert.equal(validateType('https://example.com', 'url').valid, true);
      assert.equal(validateType('http://localhost:3000/api', 'url').valid, true);
      assert.equal(validateType('postgres://user:pass@localhost:5432/db', 'url').valid, true);
      assert.equal(validateType('not-a-url', 'url').valid, false);
      assert.equal(validateType('//missing-proto', 'url').valid, false);
    });

    test('validates duration', () => {
      assert.equal(validateType('500ms', 'duration').valid, true);
      assert.equal(validateType('10s', 'duration').valid, true);
      assert.equal(validateType('5m', 'duration').valid, true);
      assert.equal(validateType('2h', 'duration').valid, true);
      assert.equal(validateType('1d', 'duration').valid, true);
      assert.equal(validateType('1000', 'duration').valid, true);
      assert.equal(validateType('invalid', 'duration').valid, false);
    });
  });

  describe('parseDurationToMs', () => {
    test('converts duration units accurately', () => {
      assert.equal(parseDurationToMs('500ms'), 500);
      assert.equal(parseDurationToMs('10s'), 10000);
      assert.equal(parseDurationToMs('5m'), 300000);
      assert.equal(parseDurationToMs('2h'), 7200000);
      assert.equal(parseDurationToMs('1d'), 86400000);
      assert.equal(parseDurationToMs('1w'), 604800000);
      assert.equal(parseDurationToMs('1h 30m'), 5400000);
    });
  });

  describe('coerceValue', () => {
    test('coerces values to native JavaScript types', () => {
      assert.equal(coerceValue('3000', 'port'), 3000);
      assert.equal(coerceValue('-42', 'int'), -42);
      assert.equal(coerceValue('true', 'bool'), true);
      assert.equal(coerceValue('1', 'bool'), true);
      assert.equal(coerceValue('yes', 'bool'), true);
      assert.equal(coerceValue('false', 'bool'), false);
      assert.equal(coerceValue('0', 'bool'), false);
      assert.equal(coerceValue('no', 'bool'), false);
      assert.equal(coerceValue('10s', 'duration'), 10000);
      assert.equal(coerceValue('https://example.com', 'url'), 'https://example.com');
    });
  });
});
