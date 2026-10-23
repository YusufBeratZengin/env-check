import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseDotenv, expandVariables } from '../src/parser.js';

describe('dotenv parser', () => {
  test('parses basic key-value pairs', () => {
    const raw = `
      FOO=bar
      BAZ=qux
      EMPTY=
    `;
    const { parsed } = parseDotenv(raw);
    assert.equal(parsed.FOO, 'bar');
    assert.equal(parsed.BAZ, 'qux');
    assert.equal(parsed.EMPTY, '');
  });

  test('parses export prefixes', () => {
    const raw = `
      export PORT=8080
      export    HOST="127.0.0.1"
      export\tSSL=false
    `;
    const { parsed } = parseDotenv(raw);
    assert.equal(parsed.PORT, '8080');
    assert.equal(parsed.HOST, '127.0.0.1');
    assert.equal(parsed.SSL, 'false');
  });

  test('parses single quoted values and multiline strings', () => {
    const raw = `
      GREETING='Hello, world!'
      MULTILINE='First line
Second line
Third line'
      LITERAL_ESCAPES='No\\nEscape'
    `;
    const { parsed } = parseDotenv(raw);
    assert.equal(parsed.GREETING, 'Hello, world!');
    assert.equal(parsed.MULTILINE, 'First line\nSecond line\nThird line');
    assert.equal(parsed.LITERAL_ESCAPES, 'No\\nEscape');
  });

  test('parses double quoted values with escape sequences', () => {
    const raw = `
      ESCAPED="Line 1\\nLine 2\\tTabbed"
      QUOTED="Quote: \\"Hello\\""
      BACKSLASH="Path\\\\to\\\\file"
      MULTILINE="Line A
Line B"
    `;
    const { parsed } = parseDotenv(raw);
    assert.equal(parsed.ESCAPED, 'Line 1\nLine 2\tTabbed');
    assert.equal(parsed.QUOTED, 'Quote: "Hello"');
    assert.equal(parsed.BACKSLASH, 'Path\\to\\file');
    assert.equal(parsed.MULTILINE, 'Line A\nLine B');
  });

  test('handles comments and inline comments', () => {
    const raw = `
      # Full line comment
      KEY1=val1 # inline comment
      KEY2="val2 # not a comment"
      KEY3='val3 # also not a comment'
      KEY4=http://localhost:3000#section
    `;
    const { parsed, commentsMap } = parseDotenv(raw);
    assert.equal(parsed.KEY1, 'val1');
    assert.equal(parsed.KEY2, 'val2 # not a comment');
    assert.equal(parsed.KEY3, 'val3 # also not a comment');
    assert.equal(parsed.KEY4, 'http://localhost:3000#section');
    assert.deepEqual(commentsMap.KEY1, ['# Full line comment']);
  });

  test('treats a comment right after "=" as an empty value', () => {
    const { parsed } = parseDotenv('EMPTY=   # nothing here\nTAB=\t# tab comment\nHASH=#kept');
    assert.equal(parsed.EMPTY, '');
    assert.equal(parsed.TAB, '');
    assert.equal(parsed.HASH, '#kept');
  });

  test('detects duplicate keys', () => {
    const raw = `
      PORT=3000
      HOST=localhost
      PORT=4000
    `;
    const { parsed, duplicates } = parseDotenv(raw);
    assert.equal(parsed.PORT, '4000');
    assert.equal(duplicates.length, 1);
    assert.equal(duplicates[0].key, 'PORT');
    assert.equal(duplicates[0].firstLine, 2);
    assert.equal(duplicates[0].line, 4);
    assert.equal(duplicates[0].value, '4000');
  });

  test('expands variables when expand option is true', () => {
    const raw = `
      BASE_URL=https://api.example.com
      V1_ENDPOINT=\${BASE_URL}/v1
      FALLBACK=\${UNDEFINED_VAR:-default_val}
    `;
    const { parsed } = parseDotenv(raw, { expand: true });
    assert.equal(parsed.BASE_URL, 'https://api.example.com');
    assert.equal(parsed.V1_ENDPOINT, 'https://api.example.com/v1');
    assert.equal(parsed.FALLBACK, 'default_val');
  });

  test('handles circular variable expansion gracefully', () => {
    const context = { A: '${B}', B: '${A}' };
    const expanded = expandVariables('${A}', context);
    // Prevents infinite recursion
    assert.equal(typeof expanded, 'string');
  });
});
