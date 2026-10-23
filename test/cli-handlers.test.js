import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runCli, parseArgs } from '../src/cli.js';

const demoArgs = ['check', '-e', 'docs/demo.env', '-s', 'docs/env.schema.json', '--no-system', '--no-git'];

function capture(t) {
  const output = { log: [], error: [], warn: [], stdout: [] };
  for (const method of ['log', 'error', 'warn']) {
    t.mock.method(console, method, (...args) => output[method].push(args.join(' ')));
  }
  t.mock.method(process.stdout, 'write', chunk => { output.stdout.push(String(chunk)); return true; });
  return output;
}

function workspace(t) {
  fs.mkdirSync('is', { recursive: true });
  const directory = fs.mkdtempSync(path.join('is', 'cli-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

describe('CLI handlers and reporting', () => {
  test('parses repeated files, aliases, and toggles without losing positional arguments', () => {
    const { flags, positional } = parseArgs([
      'check', '-e', 'first.env', '--env', 'second.env', '-x', 'example.env',
      '--schema', 'schema.json', '--no-system', '--system', '--strict',
      '--no-mask', '--expand', '--no-git', '--json', '-q',
      '-i', 'input.env', '--output', 'output.env', '--stdout', '--unknown'
    ]);
    assert.deepEqual(positional, ['check']);
    assert.deepEqual(flags.envFiles, ['first.env', 'second.env']);
    assert.equal(flags.example, 'example.env');
    assert.equal(flags.schemaFile, 'schema.json');
    assert.equal(flags.input, 'input.env');
    assert.equal(flags.output, 'output.env');
    for (const name of ['system', 'strict', 'noMask', 'expand', 'json', 'quiet', 'stdout']) {
      assert.equal(flags[name], true, name);
    }
    assert.equal(flags.checkGit, false);
  });

  test('trailing flags with missing operands retain defaults and terminate parsing', () => {
    for (const flag of ['-e', '-x', '-s', '-i', '-o']) {
      assert.deepEqual(parseArgs([flag]), parseArgs([]));
    }
  });

  test('help and version work without an environment or schema', async t => {
    const output = capture(t);
    assert.equal(await runCli(['--help']), 0);
    assert.match(output.log.join('\n'), /CHECK OPTIONS:/);
    assert.equal(await runCli(['-v']), 0);
    assert.match(output.log.join('\n'), /env-check v0\.1\.0/);
  });

  test('unknown commands return a usage error', async t => {
    const output = capture(t);
    assert.equal(await runCli(['missing-command']), 2);
    assert.match(output.error.join('\n'), /Unknown command/);
  });

  test('public values can be revealed while secret fields remain masked', async t => {
    const output = capture(t);
    assert.equal(await runCli([...demoArgs, '--no-mask']), 0);
    const text = output.log.join('\n');
    assert.match(text, /PORT=3000/);
    assert.match(text, /API_TOKEN=\[SECRET len=9\] \*{8}/);
    assert.ok(!text.includes('demo-only'));
  });

  test('quiet suppresses success, while JSON returns typed validation results', async t => {
    const output = capture(t);
    assert.equal(await runCli([...demoArgs, '--quiet']), 0);
    assert.deepEqual(output.log, []);
    assert.equal(await runCli([...demoArgs, '--json']), 0);
    const result = JSON.parse(output.log[0]);
    assert.equal(result.valid, true);
    assert.equal(result.config.PORT, 3000);
    assert.equal(result.config.DEBUG, false);
  });

  test('the default command loads an example schema and reports warnings', async t => {
    const directory = workspace(t);
    const schema = path.join(directory, 'example.env');
    const env = path.join(directory, 'input.env');
    fs.writeFileSync(schema, '# @type port\nPORT=3000\n');
    fs.writeFileSync(env, 'PORT=8080\nEXTRA=demo\n');
    const output = capture(t);
    assert.equal(await runCli(['-x', schema, '-e', env, '--no-system', '--no-git']), 0);
    assert.match(output.warn.join('\n'), /WARN.*1 warning/);
    assert.match(output.log.join('\n'), /PORT=/);
    assert.equal(await runCli(['-x', schema, '-e', env, '--no-system', '--no-git', '--strict']), 1);
    assert.match(output.error.join('\n'), /\[strict\].*EXTRA/);
  });

  test('invalid types and unknown keys report errors and warnings without revealing secrets', async t => {
    const directory = workspace(t);
    const env = path.join(directory, 'input.env');
    fs.writeFileSync(env, 'PORT=invalid\nNODE_ENV=production\nDEBUG=true\nAPI_TOKEN=demo-only\nEXTRA=demo\n');
    const output = capture(t);
    const args = ['check', '-e', env, '-s', 'docs/env.schema.json', '--no-system', '--no-git'];
    assert.equal(await runCli(args), 1);
    assert.match(output.error.join('\n'), /Type mismatch.*PORT/);
    assert.match(output.warn.join('\n'), /Warnings \(1\)/);
    assert.equal(await runCli([...args, '--json']), 1);
    assert.equal(JSON.parse(output.log[0]).valid, false);
  });

  test('missing schemas produce configuration errors in text and JSON modes', async t => {
    const output = capture(t);
    const args = ['check', '-s', 'docs/missing-schema.json', '--no-system', '--no-git'];
    assert.equal(await runCli(args), 2);
    assert.match(output.error[0], /\[ERROR\].*Schema file not found/);
    assert.equal(await runCli([...args, '--json']), 2);
    assert.match(JSON.parse(output.error[1]).error, /Schema file not found/);
  });

  test('example writes a template and removes demo token values', async t => {
    const directory = workspace(t);
    const destination = path.join(directory, 'example.env');
    const output = capture(t);
    assert.equal(await runCli(['example', '-i', 'docs/demo.env', '-o', destination]), 0);
    assert.match(output.log[0], /\[OK\]/);
    const template = fs.readFileSync(destination, 'utf8');
    assert.match(template, /# @secret\n# @required\nAPI_TOKEN=\n/);
    assert.ok(!template.includes('demo-only'));
    assert.equal(await runCli(['example', '-i', 'docs/demo.env', '--stdout']), 0);
    assert.equal(output.stdout.join(''), template);
  });

  test('example handles missing input and failed writes', async t => {
    const directory = workspace(t);
    const output = capture(t);
    assert.equal(await runCli(['example', '-i', path.join(directory, 'missing.env')]), 2);
    assert.match(output.error[0], /Input environment file not found/);
    assert.equal(await runCli(['example', '-i', 'docs/demo.env', '-o', directory]), 2);
    assert.match(output.error[1], /Failed to generate example/);
  });

  test('diff JSON reports key differences without including values', async t => {
    const output = capture(t);
    assert.equal(await runCli(['diff', 'test/fixtures/a.env', 'test/fixtures/b.env', '--json']), 1);
    const diff = JSON.parse(output.log[0]);
    assert.deepEqual(diff.onlyInA, ['REDIS_URL']);
    assert.deepEqual(diff.onlyInB, ['KAFKA_BROKER']);
    assert.ok(!output.log[0].includes('populated'));
    assert.equal(await runCli(['diff', 'docs/demo.env', 'docs/demo.env', '--json']), 0);
    assert.equal(JSON.parse(output.log[1]).identical, true);
    assert.equal(await runCli(['diff', 'docs/demo.env', 'docs/demo.env']), 0);
    assert.match(output.log[2], /Keys match \(4 common keys\)/);
  });

  test('diff handles missing arguments, either missing file, and read failures', async t => {
    const directory = workspace(t);
    const missing = path.join(directory, 'missing.env');
    const output = capture(t);
    for (const args of [[], [missing, 'docs/demo.env'], ['docs/demo.env', missing], [directory, 'docs/demo.env']]) {
      assert.equal(await runCli(['diff', ...args]), 2);
    }
    assert.match(output.error[0], /requires two file arguments/);
    assert.match(output.error[1], /File not found/);
    assert.match(output.error[2], /File not found/);
    assert.match(output.error[3], /Diff failed/);
  });
});
