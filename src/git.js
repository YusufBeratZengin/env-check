/**
 * Git repository and file tracking checks.
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';

/**
 * Checks if a given file is currently tracked by Git using `git ls-files`.
 *
 * @param {string} filePath - Path to the file to check
 * @param {string} [cwd=process.cwd()] - Working directory
 * @returns {boolean} True if the file is tracked by git
 */
export function isFileTrackedByGit(filePath, cwd = process.cwd()) {
  if (!filePath || typeof filePath !== 'string') return false;

  try {
    const resolvedPath = path.resolve(cwd, filePath);
    // Use relative path or resolved path for git command
    const relativePath = path.relative(cwd, resolvedPath);

    const result = spawnSync('git', ['ls-files', '--error-unmatch', '--', relativePath], {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 3000,
      windowsHide: true
    });

    // Exit code 0 means git is tracking this file in its index
    return result.status === 0;
  } catch {
    // If git is not installed, repo doesn't exist, etc.
    return false;
  }
}
