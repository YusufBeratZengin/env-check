/**
 * Custom zero-dependency dotenv parser.
 * Supports quotes (single, double), escapes, multiline values, export prefix,
 * inline/block comments, duplicate key tracking, and optional ${VAR} expansion.
 */

/**
 * Unescapes characters in a double-quoted string using a single-pass token replacer.
 * @param {string} str
 * @returns {string}
 */
function unescapeDoubleQuotes(str) {
  return str.replace(/\\([\s\S])/g, (match, char) => {
    switch (char) {
      case 'n': return '\n';
      case 'r': return '\r';
      case 't': return '\t';
      case '"': return '"';
      case '\\': return '\\';
      case '$': return '$';
      default: return match;
    }
  });
}

/**
 * Expands variables such as ${VAR}, $VAR, or ${VAR:-default}
 * @param {string} value
 * @param {Record<string, string>} context
 * @param {Set<string>} [visited]
 * @returns {string}
 */
export function expandVariables(value, context = {}, visited = new Set()) {
  if (typeof value !== 'string' || !value.includes('$')) {
    return value;
  }

  // Matches ${VAR}, ${VAR:-default}, or $VAR
  const VAR_REGEX = /(?<!\\)(?:\$\{([a-zA-Z_][a-zA-Z0-9_]*)(?::-([^}]*))?\}|\$([a-zA-Z_][a-zA-Z0-9_]*))/g;

  return value.replace(VAR_REGEX, (match, bracedKey, defaultValue, simpleKey) => {
    const key = bracedKey || simpleKey;
    if (visited.has(key)) {
      // Circular reference detected, return fallback or match
      return defaultValue !== undefined ? defaultValue : '';
    }

    let resolved = context[key];
    if (resolved === undefined && typeof process !== 'undefined' && process.env) {
      resolved = process.env[key];
    }

    if (resolved !== undefined) {
      const nextVisited = new Set(visited).add(key);
      return expandVariables(String(resolved), context, nextVisited);
    }

    if (defaultValue !== undefined) {
      return defaultValue;
    }

    return '';
  });
}

/**
 * Parses raw .env file contents.
 *
 * @param {string} content - Raw content of the .env file
 * @param {object} [options]
 * @param {boolean} [options.expand=false] - Whether to expand ${VAR}
 * @param {Record<string, string>} [options.context={}] - Initial context for expansion
 * @returns {{
 *   parsed: Record<string, string>,
 *   duplicates: Array<{ key: string, line: number, firstLine: number, value: string }>,
 *   entries: Array<{ key: string, value: string, line: number, comments: string[], raw: string }>,
 *   commentsMap: Record<string, string[]>
 * }}
 */
export function parseDotenv(content, options = {}) {
  const { expand = false, context = {} } = options;

  /** @type {Record<string, string>} */
  const parsed = {};
  const duplicates = [];
  const entries = [];
  /** @type {Record<string, string[]>} */
  const commentsMap = {};
  const firstSeenLine = new Map();

  if (typeof content !== 'string') {
    return { parsed, duplicates, entries, commentsMap };
  }

  // Normalize line endings to \n
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  let pendingComments = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    const currentLineNum = i + 1;

    // Blank line
    if (!trimmed) {
      // Blank line resets accumulated comments unless preceding a key immediately
      pendingComments = [];
      i++;
      continue;
    }

    // Comment line
    if (trimmed.startsWith('#')) {
      pendingComments.push(trimmed);
      i++;
      continue;
    }

    // Process line: strip "export " if present
    let lineToParse = trimmed;
    if (lineToParse.startsWith('export ') || lineToParse.startsWith('export\t')) {
      lineToParse = lineToParse.slice(6).trim();
    }

    // Find the first '='
    const eqIndex = lineToParse.indexOf('=');
    if (eqIndex === -1) {
      // Not a key-value pair, ignore and reset comments
      pendingComments = [];
      i++;
      continue;
    }

    const rawKey = lineToParse.slice(0, eqIndex).trim();
    let restOfLine = lineToParse.slice(eqIndex + 1).trimStart();

    // Check if key is valid identifier-like
    if (!rawKey) {
      pendingComments = [];
      i++;
      continue;
    }

    let value = '';
    const startLineNum = currentLineNum;

    // Check quote styles
    if (restOfLine.startsWith('"')) {
      // Double quoted
      let collected = restOfLine.slice(1);
      let foundEnd = false;

      while (true) {
        // Look for unescaped closing quote
        const endQuoteIndex = findClosingQuote(collected, '"');
        if (endQuoteIndex !== -1) {
          value = unescapeDoubleQuotes(collected.slice(0, endQuoteIndex));
          foundEnd = true;
          break;
        }

        i++;
        if (i >= lines.length) {
          // Unclosed quote: take what we have
          value = unescapeDoubleQuotes(collected);
          break;
        }
        collected += '\n' + lines[i];
      }
    } else if (restOfLine.startsWith("'")) {
      // Single quoted
      let collected = restOfLine.slice(1);
      let foundEnd = false;

      while (true) {
        const endQuoteIndex = findClosingQuote(collected, "'");
        if (endQuoteIndex !== -1) {
          value = collected.slice(0, endQuoteIndex);
          foundEnd = true;
          break;
        }

        i++;
        if (i >= lines.length) {
          value = collected;
          break;
        }
        collected += '\n' + lines[i];
      }
    } else if (restOfLine.startsWith('`')) {
      // Backtick quoted
      let collected = restOfLine.slice(1);
      while (true) {
        const endQuoteIndex = findClosingQuote(collected, '`');
        if (endQuoteIndex !== -1) {
          value = collected.slice(0, endQuoteIndex);
          break;
        }
        i++;
        if (i >= lines.length) {
          value = collected;
          break;
        }
        collected += '\n' + lines[i];
      }
    } else {
      // Unquoted value: strip trailing inline comments (separated by space)
      const inlineCommentMatch = restOfLine.match(/\s+#.*$/);
      if (inlineCommentMatch) {
        restOfLine = restOfLine.slice(0, inlineCommentMatch.index);
      }
      value = restOfLine.trim();
    }

    // Check for duplicates
    if (Object.prototype.hasOwnProperty.call(parsed, rawKey)) {
      duplicates.push({
        key: rawKey,
        line: startLineNum,
        firstLine: firstSeenLine.get(rawKey),
        value
      });
    } else {
      firstSeenLine.set(rawKey, startLineNum);
    }

    // Apply variable expansion if requested
    const finalValue = expand
      ? expandVariables(value, { ...context, ...parsed })
      : value;

    parsed[rawKey] = finalValue;
    commentsMap[rawKey] = [...pendingComments];

    entries.push({
      key: rawKey,
      value: finalValue,
      line: startLineNum,
      comments: [...pendingComments],
      raw: rawLine
    });

    pendingComments = [];
    i++;
  }

  return { parsed, duplicates, entries, commentsMap };
}

/**
 * Finds the index of the unescaped closing quote.
 * @param {string} str
 * @param {string} quoteChar
 * @returns {number}
 */
function findClosingQuote(str, quoteChar) {
  for (let idx = 0; idx < str.length; idx++) {
    if (str[idx] === quoteChar) {
      // Count preceding backslashes to check if escaped
      let backslashes = 0;
      let b = idx - 1;
      while (b >= 0 && str[b] === '\\') {
        backslashes++;
        b--;
      }
      if (backslashes % 2 === 0) {
        return idx;
      }
    }
  }
  return -1;
}
