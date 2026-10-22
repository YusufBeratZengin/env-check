/**
 * Type validation and coercion for environment variables.
 * Supported types: url, int, bool, enum(a,b), email, port, duration, string.
 */

const DURATION_TOKEN_REGEX = /(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w|y)/gi;
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const DURATION_MULTIPLIERS = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
  y: 365 * 24 * 60 * 60 * 1000
};

/**
 * Parses duration string into total milliseconds.
 * Returns null if duration string is invalid.
 * @param {string} str
 * @returns {number|null}
 */
export function parseDurationToMs(str) {
  if (typeof str !== 'string') return null;
  const trimmed = str.trim();
  if (!trimmed) return null;

  // Pure digits: treat as milliseconds
  if (/^\d+$/.test(trimmed)) {
    const num = Number(trimmed);
    return Number.isSafeInteger(num) ? num : null;
  }

  // Tokenize duration e.g. "1h 30m" or "500ms"
  let match;
  let totalMs = 0;
  let matchedLength = 0;
  DURATION_TOKEN_REGEX.lastIndex = 0;

  while ((match = DURATION_TOKEN_REGEX.exec(trimmed)) !== null) {
    const value = parseFloat(match[1]);
    const unit = match[2].toLowerCase();
    const multiplier = DURATION_MULTIPLIERS[unit];
    if (multiplier === undefined || isNaN(value)) {
      return null;
    }
    totalMs += value * multiplier;
    matchedLength += match[0].length;
  }

  // Verify that the whole string (ignoring whitespace) was consumed
  const stripped = trimmed.replace(/\s+/g, '');
  if (matchedLength === 0 || stripped.length > matchedLength) {
    return null;
  }

  return Math.round(totalMs);
}

/**
 * Normalizes a type string and extracts enum values if present.
 * @param {string} rawType
 * @returns {{ type: string, enumValues?: string[] }}
 */
export function parseTypeDefinition(rawType) {
  if (!rawType || typeof rawType !== 'string') {
    return { type: 'string' };
  }

  const trimmed = rawType.trim();

  // enum(a, b, c) or enum(a,b)
  const enumMatch = /^enum\s*\(([^)]*)\)$/i.exec(trimmed);
  if (enumMatch) {
    const values = enumMatch[1]
      .split(',')
      .map(v => v.trim())
      .filter(Boolean);
    return { type: 'enum', enumValues: values };
  }

  const lower = trimmed.toLowerCase();
  if (lower === 'integer') return { type: 'int' };
  if (lower === 'boolean') return { type: 'bool' };
  if (['url', 'int', 'bool', 'email', 'port', 'duration', 'string'].includes(lower)) {
    return { type: lower };
  }

  return { type: lower };
}

/**
 * Validates a string value against a type specification.
 * @param {string} value
 * @param {string} type
 * @param {string[]} [enumValues]
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateType(value, type, enumValues = []) {
  if (typeof value !== 'string') {
    return { valid: false, error: 'Value must be a string' };
  }

  const trimmed = value.trim();

  switch (type) {
    case 'string':
      return { valid: true };

    case 'int': {
      if (!/^-?\d+$/.test(trimmed)) {
        return { valid: false, error: 'Expected integer value' };
      }
      const num = Number(trimmed);
      if (!Number.isSafeInteger(num)) {
        return { valid: false, error: 'Integer exceeds safe limits' };
      }
      return { valid: true };
    }

    case 'port': {
      if (!/^\d+$/.test(trimmed)) {
        return { valid: false, error: 'Port must be a positive integer' };
      }
      const port = Number(trimmed);
      if (port < 1 || port > 65535) {
        return { valid: false, error: 'Port must be between 1 and 65535' };
      }
      return { valid: true };
    }

    case 'bool': {
      if (!/^(true|false|1|0|yes|no)$/i.test(trimmed)) {
        return { valid: false, error: 'Expected boolean (true, false, 1, 0, yes, no)' };
      }
      return { valid: true };
    }

    case 'enum': {
      if (!enumValues || enumValues.length === 0) {
        return { valid: false, error: 'Enum has no allowed values configured' };
      }
      if (!enumValues.includes(trimmed)) {
        return {
          valid: false,
          error: `Expected one of: ${enumValues.join(', ')}`
        };
      }
      return { valid: true };
    }

    case 'email': {
      if (!EMAIL_REGEX.test(trimmed)) {
        return { valid: false, error: 'Invalid email address format' };
      }
      return { valid: true };
    }

    case 'url': {
      try {
        const parsed = new URL(trimmed);
        if (!parsed.protocol || !parsed.protocol.includes(':')) {
          return { valid: false, error: 'Invalid URL: missing protocol' };
        }
        return { valid: true };
      } catch {
        return { valid: false, error: 'Invalid URL format' };
      }
    }

    case 'duration': {
      const ms = parseDurationToMs(trimmed);
      if (ms === null || isNaN(ms)) {
        return { valid: false, error: 'Invalid duration (expected e.g. 500ms, 10s, 5m, 2h, 1d)' };
      }
      return { valid: true };
    }

    default:
      // Unknown type treated as string
      return { valid: true };
  }
}

/**
 * Coerces a validated string value to its native JavaScript type.
 * @param {string} value
 * @param {string} type
 * @returns {any}
 */
export function coerceValue(value, type) {
  if (value === undefined || value === null) {
    return value;
  }
  const str = String(value);
  const trimmed = str.trim();

  switch (type) {
    case 'int':
    case 'port':
      return parseInt(trimmed, 10);

    case 'bool':
      return /^(true|1|yes)$/i.test(trimmed);

    case 'duration': {
      const ms = parseDurationToMs(trimmed);
      return ms !== null ? ms : trimmed;
    }

    default:
      return str;
  }
}
