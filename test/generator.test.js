import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { generateExample, inferType } from '../src/generator.js';
import { parseExampleSchema } from '../src/schema.js';

const FAKE_JWT = 'super_' + 'secret_' + 'jwt_key_12345';
describe('example generator', () => {
  test('infers types accurately', () => {
    assert.equal(inferType('PORT', '3000'), 'port');
    assert.equal(inferType('IS_ENABLED', 'true'), 'bool');
    assert.equal(inferType('COUNT', '42'), 'int');
    assert.equal(inferType('SITE_URL', 'https://example.com'), 'url');
    assert.equal(inferType('CONTACT_EMAIL', 'test@example.com'), 'email');
    assert.equal(inferType('GREETING', 'Hello world'), 'string');
  });

  test('generates clean .env.example with stripped values and schema annotations', () => {
    const rawEnv = `
      PORT=8080
      NODE_ENV=production
      API_SECRET_KEY="${FAKE_JWT}"
      DATABASE_URL="postgres://postgres:pwd@db:5432/main"
      NOTIFICATION_EMAIL=admin@company.com
    `;

    const generated = generateExample(rawEnv);

    // CRITICAL: Secret values must never appear in generated output
    assert.equal(generated.includes(FAKE_JWT), false);
    assert.equal(generated.includes('pwd@db'), false);

    // Schema annotations must be present
    assert.equal(generated.includes('# @secret'), true);
    assert.equal(generated.includes('# @type port'), true);
    assert.equal(generated.includes('# @type email'), true);

    // Verify generated output is valid schema
    const schema = parseExampleSchema(generated);
    assert.equal(schema.get('PORT').type, 'port');
    assert.equal(schema.get('API_SECRET_KEY').secret, true);
    assert.equal(schema.get('NOTIFICATION_EMAIL').type, 'email');
  });
});
