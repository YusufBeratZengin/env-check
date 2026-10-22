import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { maskSecret, maskValue, isLikelySecret } from '../src/masker.js';

describe('secret masker', () => {
  test('maskSecret shows length and fixed mask without leaking contents', () => {
    const secret = 'super_' + 'secret_' + 'api_token_12345';
    const masked = maskSecret(secret);

    assert.equal(masked, '[SECRET len=28] ********');
    assert.equal(masked.includes(secret), false);
    assert.equal(masked.includes('api_token'), false);
  });

  test('maskValue masks all values by default', () => {
    const val = '3000';
    const masked = maskValue(val, false, false);
    assert.equal(masked.includes('3000'), false);
    assert.equal(masked, '*** (len=4)');
  });

  test('maskValue reveals non-secret value when showPublic is true', () => {
    const val = '3000';
    const revealed = maskValue(val, false, true);
    assert.equal(revealed, '3000');
  });

  test('maskValue NEVER reveals secret value even when showPublic is true', () => {
    const secret = 'sk_' + 'live_' + '1234567890abcdef';
    const result = maskValue(secret, true, true);

    assert.equal(result.includes('sk_' + 'live'), false);
    assert.equal(result, `[SECRET len=${secret.length}] ********`);
  });

  test('identifies likely secret variable names', () => {
    assert.equal(isLikelySecret('API_KEY'), true);
    assert.equal(isLikelySecret('DATABASE_URL'), false); // explicitly annotated in schema or can be handled
    assert.equal(isLikelySecret('AUTH_TOKEN'), true);
    assert.equal(isLikelySecret('USER_PASSWORD'), true);
    assert.equal(isLikelySecret('APP_SECRET'), true);
    assert.equal(isLikelySecret('PORT'), false);
    assert.equal(isLikelySecret('NODE_ENV'), false);
  });
});
