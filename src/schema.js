/**
 * Schema parser supporting:
 * 1. .env.example annotations:
 *    type: url, int, bool, enum(a,b), email, port, duration, string
 *    required, default, secret, and pattern comment directives
 * 2. env.schema.json (JSON Schema compatible)
 */

import { parseDotenv } from './parser.js';
import { parseTypeDefinition } from './types.js';
import { isLikelySecret } from './masker.js';
import { isPlaceholder } from './placeholders.js';
import { SchemaError } from './errors.js';

/**
 * Parses regex pattern from comment tag e.g. "/^[a-z]+$/i" or "^[a-z]+$"
 * @param {string} rawPattern
 * @returns {RegExp}
 */
function parseRegexPattern(rawPattern) {
  const trimmed = rawPattern.trim();
  const match = trimmed.match(/^\/(.*)\/([gimsuy]*)$/);
  if (match) {
    return new RegExp(match[1], match[2]);
  }
  return new RegExp(trimmed);
}

export class Schema {
  /**
   * @param {Map<string, object>} fields
   */
  constructor(fields = new Map()) {
    this.fields = fields;
  }

  has(key) {
    return this.fields.has(key);
  }

  get(key) {
    return this.fields.get(key);
  }

  keys() {
    return Array.from(this.fields.keys());
  }

  entries() {
    return Array.from(this.fields.entries());
  }

  get size() {
    return this.fields.size;
  }
}

/**
 * Parses schema from .env.example file content.
 *
 * @param {string} content - Raw content of .env.example
 * @returns {Schema}
 */
export function parseExampleSchema(content) {
  const { entries } = parseDotenv(content);
  const fields = new Map();

  // Check if any key explicitly uses @required
  let hasAnyRequiredAnnotation = false;
  for (const entry of entries) {
    if (entry.comments.some(c => /#\s*@required\b/i.test(c))) {
      hasAnyRequiredAnnotation = true;
      break;
    }
  }

  for (const entry of entries) {
    const key = entry.key;
    const comments = entry.comments || [];

    let typeStr = 'string';
    let isRequired = false;
    let explicitDefault = undefined;
    let isSecret = isLikelySecret(key);
    let pattern = undefined;
    const descriptions = [];

    for (const comment of comments) {
      const cleanComment = comment.replace(/^#\s*/, '').trim();

      // @type url|int|bool|enum(a,b)|email|port|duration|string
      const typeMatch = cleanComment.match(/^@type\s+(.+)$/i);
      if (typeMatch) {
        typeStr = typeMatch[1].trim();
        continue;
      }

      // @required
      if (/^@required\b/i.test(cleanComment)) {
        isRequired = true;
        continue;
      }

      // @optional
      if (/^@optional\b/i.test(cleanComment)) {
        isRequired = false;
        continue;
      }

      // @default <val>
      const defaultMatch = cleanComment.match(/^@default\s*(.*)$/i);
      if (defaultMatch) {
        explicitDefault = defaultMatch[1].trim();
        continue;
      }

      // @secret
      if (/^@secret\b/i.test(cleanComment)) {
        isSecret = true;
        continue;
      }

      // @pattern /regex/
      const patternMatch = cleanComment.match(/^@pattern\s+(.+)$/i);
      if (patternMatch) {
        try {
          pattern = parseRegexPattern(patternMatch[1]);
        } catch (err) {
          throw new SchemaError(`Invalid regex pattern for key "${key}": ${err.message}`, key);
        }
        continue;
      }

      // General comment / description
      if (!cleanComment.startsWith('@')) {
        descriptions.push(cleanComment);
      }
    }

    // Default determination:
    // If @default was not explicitly given in comments, but .env.example has a value:
    // treat entry.value as default if non-empty and not a placeholder!
    let defaultValue = explicitDefault;
    if (defaultValue === undefined && entry.value && !isPlaceholder(entry.value)) {
      defaultValue = entry.value;
    }

    // Required determination:
    // If hasAnyRequiredAnnotation is false, keys without a default are required by default
    if (!hasAnyRequiredAnnotation) {
      isRequired = defaultValue === undefined;
    }

    const { type, enumValues } = parseTypeDefinition(typeStr);

    fields.set(key, {
      key,
      type,
      enumValues,
      required: isRequired,
      default: defaultValue,
      secret: isSecret,
      pattern,
      description: descriptions.join(' '),
      line: entry.line
    });
  }

  return new Schema(fields);
}

/**
 * Parses schema from JSON Schema object or JSON string.
 *
 * @param {string|object} jsonContent
 * @returns {Schema}
 */
export function parseJsonSchema(jsonContent) {
  let json;
  if (typeof jsonContent === 'string') {
    try {
      json = JSON.parse(jsonContent);
    } catch (err) {
      throw new SchemaError(`Failed to parse JSON schema: ${err.message}`);
    }
  } else {
    json = jsonContent;
  }

  if (!json || typeof json !== 'object') {
    throw new SchemaError('JSON schema must be an object');
  }

  const fields = new Map();
  const properties = json.properties || {};
  const requiredKeys = new Set(Array.isArray(json.required) ? json.required : []);

  for (const [key, prop] of Object.entries(properties)) {
    if (!prop || typeof prop !== 'object') continue;

    let typeStr = prop.type || 'string';
    let enumValues = undefined;

    if (Array.isArray(prop.enum)) {
      typeStr = 'enum';
      enumValues = prop.enum.map(String);
    } else if (prop.format === 'uri' || prop.format === 'url') {
      typeStr = 'url';
    } else if (prop.format === 'email') {
      typeStr = 'email';
    }

    const { type, enumValues: parsedEnumValues } = parseTypeDefinition(typeStr);

    let pattern;
    if (prop.pattern) {
      try {
        pattern = new RegExp(prop.pattern);
      } catch (err) {
        throw new SchemaError(`Invalid pattern for property "${key}": ${err.message}`, key);
      }
    }

    const isSecret = Boolean(prop.secret || prop['x-secret'] || isLikelySecret(key));
    const isRequired = requiredKeys.has(key);
    const defaultValue = prop.default !== undefined ? String(prop.default) : undefined;

    fields.set(key, {
      key,
      type,
      enumValues: enumValues || parsedEnumValues,
      required: isRequired,
      default: defaultValue,
      secret: isSecret,
      pattern,
      description: prop.description || '',
      line: undefined
    });
  }

  return new Schema(fields);
}
