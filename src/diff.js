/**
 * Key-only environment diffing.
 * Guarantees zero secret value leakage: only key names and presence states are compared.
 */

import fs from 'node:fs';
import { parseDotenv } from './parser.js';

/**
 * Compares two environment variable maps by key.
 *
 * @param {Record<string, string>} mapA
 * @param {Record<string, string>} mapB
 * @param {object} [labels]
 * @param {string} [labels.nameA='File A']
 * @param {string} [labels.nameB='File B']
 * @returns {{
 *   onlyInA: string[],
 *   onlyInB: string[],
 *   common: Array<{ key: string, statusA: 'set' | 'empty', statusB: 'set' | 'empty' }>,
 *   identical: boolean
 * }}
 */
export function diffEnvMaps(mapA = {}, mapB = {}, labels = {}) {
  const keysA = new Set(Object.keys(mapA));
  const keysB = new Set(Object.keys(mapB));

  const onlyInA = Array.from(keysA).filter(k => !keysB.has(k)).sort();
  const onlyInB = Array.from(keysB).filter(k => !keysA.has(k)).sort();

  const commonKeys = Array.from(keysA).filter(k => keysB.has(k)).sort();
  /** @type {Array<{key: string, statusA: 'set' | 'empty', statusB: 'set' | 'empty'}>} */
  const common = commonKeys.map(key => {
    const valA = mapA[key];
    const valB = mapB[key];
    return {
      key,
      statusA: valA && valA.trim().length > 0 ? 'set' : 'empty',
      statusB: valB && valB.trim().length > 0 ? 'set' : 'empty'
    };
  });

  const identical = onlyInA.length === 0 && onlyInB.length === 0;

  return {
    onlyInA,
    onlyInB,
    common,
    identical
  };
}

/**
 * Compares two .env files by reading and parsing their keys.
 *
 * @param {string} fileAPath
 * @param {string} fileBPath
 * @returns {{
 *   fileA: string,
 *   fileB: string,
 *   onlyInA: string[],
 *   onlyInB: string[],
 *   common: Array<{ key: string, statusA: string, statusB: string }>,
 *   identical: boolean
 * }}
 */
export function diffEnvFiles(fileAPath, fileBPath) {
  const contentA = fs.readFileSync(fileAPath, 'utf8');
  const contentB = fs.readFileSync(fileBPath, 'utf8');

  const parsedA = parseDotenv(contentA).parsed;
  const parsedB = parseDotenv(contentB).parsed;

  const diff = diffEnvMaps(parsedA, parsedB, { nameA: fileAPath, nameB: fileBPath });

  return {
    fileA: fileAPath,
    fileB: fileBPath,
    ...diff
  };
}

/**
 * Formats a diff result into human-readable string.
 * Never prints any values, strictly keys and statuses.
 *
 * @param {object} diffResult
 * @returns {string}
 */
export function formatDiff(diffResult) {
  const { fileA, fileB, onlyInA, onlyInB, common, identical } = diffResult;
  const lines = [];

  lines.push(`Comparing: ${fileA || 'source A'} <-> ${fileB || 'source B'}`);
  lines.push('');

  if (identical && common.length === 0) {
    lines.push('Both environment files are empty.');
    return lines.join('\n');
  }

  if (identical) {
    lines.push(`Keys match (${common.length} common keys). No key differences found.`);
  }

  if (onlyInA.length > 0) {
    lines.push(`(-) Only in ${fileA || 'File A'} (${onlyInA.length}):`);
    for (const key of onlyInA) {
      lines.push(`  - ${key}`);
    }
    lines.push('');
  }

  if (onlyInB.length > 0) {
    lines.push(`(+) Only in ${fileB || 'File B'} (${onlyInB.length}):`);
    for (const key of onlyInB) {
      lines.push(`  + ${key}`);
    }
    lines.push('');
  }

  if (common.length > 0) {
    lines.push(`(=) Common keys (${common.length}):`);
    for (const item of common) {
      if (item.statusA === item.statusB) {
        lines.push(`  = ${item.key} (both ${item.statusA})`);
      } else {
        lines.push(`  = ${item.key} (${item.statusA} in ${fileA || 'A'}, ${item.statusB} in ${fileB || 'B'})`);
      }
    }
  }

  return lines.join('\n');
}
