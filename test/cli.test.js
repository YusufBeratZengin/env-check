import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const BIN = path.resolve('bin/env-check.js');
const FIXTURES_DIR = path.resolve('test/fixtures');

function runBin(args) {
  const result = spawnSync(process.execPath, [BIN, ...args], {
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' }
  });
  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || ''
  };
}

describe('CLI execution and exit codes', () => {
  test('--version prints version and exits 0', () => {
    const res = runBin(['--version']);
    assert.equal(res.status, 0);
    assert.ok(res.stdout.includes('env-check v0.1.0'));
  });

  test('--help prints help and exits 0', () => {
    const res = runBin(['--help']);
    assert.equal(res.status, 0);
    assert.ok(res.stdout.includes('USAGE:'));
    assert.ok(res.stdout.includes('COMMANDS:'));
  });

  test('check passes with valid env file (exit 0)', () => {
    const example = path.join(FIXTURES_DIR, '.env.example');
    const valid = path.join(FIXTURES_DIR, '.env.valid');

    const res = runBin(['check', '-x', example, '-e', valid, '--no-system', '--no-git']);
    assert.equal(res.status, 0);
    assert.ok(res.stdout.includes('[PASS]'));
  });

  test('check fails with invalid env file (exit 1)', () => {
    const example = path.join(FIXTURES_DIR, '.env.example');
    const invalid = path.join(FIXTURES_DIR, '.env.invalid');

    const res = runBin(['check', '-x', example, '-e', invalid, '--no-system', '--no-git']);
    assert.equal(res.status, 1);
    assert.ok(res.stderr.includes('[FAIL]'));
  });

  test('check --json outputs parsable JSON', () => {
    const example = path.join(FIXTURES_DIR, '.env.example');
    const valid = path.join(FIXTURES_DIR, '.env.valid');

    const res = runBin(['check', '-x', example, '-e', valid, '--no-system', '--no-git', '--json']);
    assert.equal(res.status, 0);

    const parsed = JSON.parse(res.stdout);
    assert.equal(parsed.valid, true);
    assert.equal(parsed.config.PORT, 8080);
  });

  test('diff compares keys between two files', () => {
    const fileA = path.join(FIXTURES_DIR, 'a.env');
    const fileB = path.join(FIXTURES_DIR, 'b.env');

    const res = runBin(['diff', fileA, fileB]);
    assert.equal(res.status, 1); // Differing keys exits 1
    assert.ok(res.stdout.includes('(-) Only in'));
    assert.ok(res.stdout.includes('(+) Only in'));
  });

  test('diff returns exit 0 for identical key sets', () => {
    const fileA = path.join(FIXTURES_DIR, 'a.env');

    const res = runBin(['diff', fileA, fileA]);
    assert.equal(res.status, 0);
    assert.ok(res.stdout.includes('Keys match'));
  });

  test('example command outputs generated template to stdout', () => {
    const valid = path.join(FIXTURES_DIR, '.env.valid');

    const res = runBin(['example', '-i', valid, '--stdout']);
    assert.equal(res.status, 0);
    assert.ok(res.stdout.includes('# @type port'));
    assert.ok(res.stdout.includes('# @secret'));
  });
});
