/**
 * Detection of placeholder and template values left unconfigured.
 */

const EXACT_PLACEHOLDERS = new Set([
  'changeme',
  'change_me',
  'change-me',
  'change.me',
  'todo',
  'fixme',
  'placeholder',
  'replace_me',
  'replace-me',
  'replaceme',
  'replace_this',
  'insert_here',
  'insert-here',
  'inserthere',
  'your_api_key_here',
  'your-api-key-here',
  'your_token_here',
  'your_secret_here',
  'your_password_here',
  'your_key_here',
  'dummy',
  'dummy_value',
  'test_value',
  'sample_key',
  'sample_secret'
]);

const PLACEHOLDER_PATTERNS = [
  // Angle brackets: <api_key>, <YOUR_KEY>, etc.
  /^<[^>]+>$/,
  // Curly brackets / template tags: {YOUR_KEY}, {{YOUR_KEY}}
  /^\{+[^{}]+\}+$/,
  // Square brackets: [YOUR_KEY]
  /^\[[^[\]]+\]$/,
  // Repeated placeholders: xxx, xxxx, ****
  /^[xX*#]{3,}$/,
  // Starts with "your_" / "your-" followed by common placeholder targets
  /^your[-_.](?:api[-_.]?key|token|secret|password|client[-_.]?id|database[-_.]?url|key)/i,
  // Starts with "insert_" / "insert-"
  /^insert[-_.](?:here|key|secret|token|value)/i,
  // Contains explicit changeme or replace_me
  /(?:changeme|replace[-_]?me)/i
];

/**
 * Checks whether a given string value is an obvious placeholder.
 * @param {any} value
 * @returns {boolean}
 */
export function isPlaceholder(value) {
  if (value === undefined || value === null) return false;
  const str = String(value).trim();
  if (!str) return false;

  const lower = str.toLowerCase();
  if (EXACT_PLACEHOLDERS.has(lower)) {
    return true;
  }

  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(str)) {
      return true;
    }
  }

  return false;
}
