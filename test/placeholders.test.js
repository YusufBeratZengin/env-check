import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isPlaceholder } from '../src/placeholders.js';

describe('placeholder detector', () => {
  test('identifies common template placeholders', () => {
    assert.equal(isPlaceholder('changeme'), true);
    assert.equal(isPlaceholder('change_me'), true);
    assert.equal(isPlaceholder('CHANGE-ME'), true);
    assert.equal(isPlaceholder('todo'), true);
    assert.equal(isPlaceholder('TODO'), true);
    assert.equal(isPlaceholder('fixme'), true);
    assert.equal(isPlaceholder('placeholder'), true);
    assert.equal(isPlaceholder('your_api_key_here'), true);
    assert.equal(isPlaceholder('YOUR-API-KEY-HERE'), true);
  });

  test('identifies bracketed template tags', () => {
    assert.equal(isPlaceholder('<api_key>'), true);
    assert.equal(isPlaceholder('<YOUR_SECRET_TOKEN>'), true);
    assert.equal(isPlaceholder('{API_KEY}'), true);
    assert.equal(isPlaceholder('{{SECRET}}'), true);
    assert.equal(isPlaceholder('[TOKEN]'), true);
  });

  test('identifies masked or repeated placeholder symbols', () => {
    assert.equal(isPlaceholder('xxx'), true);
    assert.equal(isPlaceholder('XXXX'), true);
    assert.equal(isPlaceholder('*****'), true);
    assert.equal(isPlaceholder('###'), true);
  });

  test('identifies prefixes like your_ or insert_', () => {
    assert.equal(isPlaceholder('your_secret'), true);
    assert.equal(isPlaceholder('your-token'), true);
    assert.equal(isPlaceholder('insert_key_here'), true);
  });

  test('passes genuine values without false positives', () => {
    assert.equal(isPlaceholder('3000'), false);
    assert.equal(isPlaceholder('production'), false);
    assert.equal(isPlaceholder('postgres://user:pass@localhost:5432/db'), false);
    assert.equal(isPlaceholder('sk_' + 'live_' + '9876543210abcdef'), false);
    assert.equal(isPlaceholder('user@example.com'), false);
    assert.equal(isPlaceholder(''), false);
  });
});
