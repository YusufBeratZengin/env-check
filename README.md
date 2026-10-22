# env-check

Validate environment variables and `.env` files against a schema defined in `.env.example` or `env.schema.json`, without ever printing secret values.

Applications often fail in continuous integration or production due to missing or malformed environment variables. During troubleshooting, developers frequently leak credentials by echoing `.env` files into logs. `env-check` solves both problems: it enforces strong schemas at startup and in CI while strictly redacting sensitive values.

## Highlights

- Zero runtime dependencies: Built on Node.js standard library.
- Secret protection guarantee: Variables marked `@secret` are never printed in console output, error messages, diffs, or templates. A fixed mask and string length are shown instead.
- Native dotenv parser: Full support for single quotes, double quotes with escapes (`\n`, `\t`, `\"`, `\\`), multiline values, `export` prefixes, comments, and optional `${VAR}` expansion.
- Comment-driven schema: Define types, requirements, defaults, and regex patterns directly inside `.env.example`.
- JSON schema support: Validate against `env.schema.json` using standard JSON Schema definitions.
- Early security warnings: Warns immediately if a `.env` file containing credentials is tracked by Git (via `git ls-files`).
- Placeholder detection: Blocks leftover boilerplate values such as `changeme`, `xxx`, `<...>`, or `your_api_key_here`.
- CI-ready CLI: Meaningful exit codes for automated pipelines.
- Library API: Load and validate configuration at application startup with typed output (`number`, `boolean`, `string`, `duration in ms`).

## Requirements

- Node.js >= 20.0.0

## Installation

```bash
# Global CLI usage
npm install -g env-check

# Or project-level installation
npm install env-check
```

Or execute directly via `npx`:

```bash
npx env-check check
```

## Schema Syntax in `.env.example`

Annotate variables with comment directives directly preceding each key:

```bash
# HTTP port for the web service
# @type port
# @default 3000
PORT=3000

# Application environment
# @type enum(development, staging, production)
# @default development
NODE_ENV=development

# Database connection URL
# @type url
# @secret
# @required
DATABASE_URL=

# Administrative alert email
# @type email
# @required
ADMIN_EMAIL=

# Cache time-to-live duration
# @type duration
# @default 15m
CACHE_TTL=15m

# Stripe API key matching pattern
# @pattern /^sk_[a-z0-9]{24}$/
# @secret
# @required
STRIPE_SECRET_KEY=

# Optional feature toggle
# @type bool
# @default false
ENABLE_FEATURE_FLAGS=false
```

### Supported Directives

| Directive | Description | Example |
| --------- | ----------- | ------- |
| `# @type <type>` | Value type (`url`, `int`, `bool`, `enum(...)`, `email`, `port`, `duration`, `string`) | `# @type port` |
| `# @required` | Variable must be present and non-empty | `# @required` |
| `# @optional` | Variable is optional even if no default is provided | `# @optional` |
| `# @default <val>` | Fallback value if variable is missing or empty | `# @default 3000` |
| `# @secret` | Strictly masks value in all CLI outputs and error messages | `# @secret` |
| `# @pattern <regex>` | Regular expression pattern validation | `# @pattern /^sk_[a-z0-9]+$/` |

### Supported Types

- `port`: Integer between 1 and 65535.
- `int` / `integer`: Safe whole integer.
- `bool` / `boolean`: Accepts `true`, `false`, `1`, `0`, `yes`, `no` (case-insensitive).
- `enum(val1, val2, ...)`: Value must match one of the listed options.
- `url`: Valid URL with protocol (`http`, `https`, `postgres`, `redis`, etc.).
- `email`: Valid RFC 5322 compatible email address.
- `duration`: Time span string (`500ms`, `10s`, `5m`, `2h`, `1d`, `1w`, `1y`) or milliseconds. Coerces to milliseconds.
- `string`: Any text value.

## JSON Schema Support (`env.schema.json`)

Alternatively, define your environment schema in standard JSON Schema:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["PORT", "DATABASE_URL"],
  "properties": {
    "PORT": {
      "type": "integer",
      "default": 3000,
      "description": "HTTP port"
    },
    "DATABASE_URL": {
      "type": "string",
      "format": "uri",
      "secret": true
    },
    "NODE_ENV": {
      "type": "string",
      "enum": ["development", "staging", "production"],
      "default": "development"
    }
  }
}
```

## CLI Usage

### 1. `check` (default command)

Validates environment variables and `.env` files against the schema.

```bash
# Validate .env against .env.example
env-check check

# Specify custom env files and schema
env-check check -e .env -e .env.local -x .env.example

# Validate using JSON schema
env-check check -s env.schema.json

# Fail on warnings (unknown variables, duplicate keys, git-tracked .env)
env-check check --strict

# Output results as JSON for CI reporting
env-check check --json

# Reveal non-secret values (secret values always remain masked)
env-check check --no-mask

# Enable variable expansion (${VAR})
env-check check --expand
```

#### Exit Codes

| Code | Meaning |
| ---- | ------- |
| `0`  | Success: All variables conform to schema. |
| `1`  | Failure: Missing required variables, type mismatch, placeholder found, or strict warning. |
| `2`  | Error: Schema file missing, invalid syntax, or execution failure. |

### 2. `example`

Generates a clean `.env.example` file from an existing `.env` file. Strips all credentials and sensitive data while inferring types and adding schema directives.

```bash
# Generate .env.example from .env
env-check example

# Specify input and output paths
env-check example -i .env.production -o .env.example

# Print directly to stdout
env-check example --stdout
```

### 3. `diff`

Compares the keys of two `.env` files. Shows missing and differing keys with zero value leakage.

```bash
env-check diff .env.development .env.production
```

Output example:

```
Comparing: .env.development <-> .env.production

(-) Only in .env.development (1):
  - DEBUG_TOOLBAR

(+) Only in .env.production (1):
  + SENTRY_DSN

(=) Common keys (3):
  = PORT (both set)
  = DATABASE_URL (both set)
  = REDIS_CACHE (empty in .env.development, set in .env.production)
```

## Library API

Import `env-check` directly into application code for startup validation:

```javascript
import { validateEnv } from 'env-check';

// Validates process.env and .env against .env.example
const { valid, config, errors, warnings } = validateEnv({
  example: '.env.example',
  throwOnError: true // Throws ValidationError if invalid
});

// Typed output:
console.log(config.PORT);       // number: 3000
console.log(config.CACHE_TTL);  // number (ms): 900000
console.log(config.DEBUG);      // boolean: false
```

### Custom Configuration Options

```javascript
import { validateEnv, loadSchema, parseDotenv } from 'env-check';

const result = validateEnv({
  example: '.env.example',           // Schema file path
  schemaFile: 'env.schema.json',     // Or JSON schema path
  files: ['.env', '.env.local'],     // Files to load in sequence
  system: true,                      // Merge process.env (default: true)
  strict: true,                      // Treat warnings as errors
  expand: true,                      // Support ${VAR} expansion
  checkGit: true,                    // Warn if .env is tracked in git
  throwOnError: false                // Return error list instead of throwing
});

if (!result.valid) {
  for (const err of result.errors) {
    console.error(`${err.key}: ${err.message}`);
  }
  process.exit(1);
}
```

## Secret Redaction Policy

Security and secrecy are fundamental guarantees of `env-check`:

1. Any key marked with `# @secret` (or inferred as sensitive) will display as:
   `[SECRET len=24] ********`
2. Raw secret values are never printed in error messages, logs, or JSON summaries.
3. Even when running with `--no-mask`, keys tagged `@secret` remain masked.
4. Diff operations only compare key names and presence states; values are never inspected or rendered.

## Contributing

Please review [CONTRIBUTING.md](CONTRIBUTING.md) for testing and development guidelines.

## License

MIT License. Copyright (c) 2026 Yusuf Berat Zengin. See [LICENSE](LICENSE) for details.
