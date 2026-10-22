import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isFileTrackedByGit } from '../src/git.js';

describe('git file tracking check', () => {
  test('returns true for files tracked in git', () => {
    // package.json was committed in root commit
    const tracked = isFileTrackedByGit('package.json');
    assert.equal(tracked, true);
  });

  test('returns false for untracked or non-existent files', () => {
    const tracked = isFileTrackedByGit('non_existent_file.tmp');
    assert.equal(tracked, false);
  });

  test('handles invalid inputs gracefully without throwing', () => {
    assert.equal(isFileTrackedByGit(''), false);
    assert.equal(isFileTrackedByGit(null), false);
  });
});
