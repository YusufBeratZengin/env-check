# env-check

[![CI](https://github.com/YusufBeratZengin/env-check/actions/workflows/ci.yml/badge.svg)](https://github.com/YusufBeratZengin/env-check/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js >=20](https://img.shields.io/badge/node-%3E%3D20-339933.svg)](package.json)
[![npm version](https://img.shields.io/npm/v/env-check.svg)](https://www.npmjs.com/package/env-check)

Validate `.env` files against a schema, catch missing configuration, and mask secrets in terminal reports.

[Türkçe](README.tr.md) · [Contributing](CONTRIBUTING.md) · [Changelog](CHANGELOG.md)

![Real env-check output: generating a template with the demo token removed](docs/demo.svg)

## Why env-check?

- **No runtime dependencies.** A Node.js CLI and library built on the standard library.
- **Schemas beside your configuration.** Annotate `.env.example` or use a supported subset of JSON Schema, with types, defaults, and patterns.
- **Useful CI feedback.** Catch placeholders, duplicate keys, and Git-tracked env files; compare key sets without displaying values.

## Quick start

Requires Node.js 20 or newer:

```bash
git clone https://github.com/YusufBeratZengin/env-check.git
cd env-check
node bin/env-check.js example -i docs/demo.env --stdout
node bin/env-check.js check -e docs/demo.env -s docs/env.schema.json --no-system --no-git
```

Both CLI commands work without installing packages. The first produces the demo above; the second exits `0` and reports `4/4 variables verified`. The fixture contains public demo data only.

These instructions run the checked-out source without relying on an npm release. The npm badge shows registry status and may be unavailable before publication. After installing this package, `env-check` is the equivalent executable.

## Usage examples

```bash
# Check .env using .env.example in your own project
node bin/env-check.js check

# Merge files in order; the later file overrides earlier values
node bin/env-check.js check -e .env -e .env.local -x .env.example --no-system

# Fail on warnings as well as validation errors
node bin/env-check.js check --strict --no-system

# Reveal public values; secret fields remain masked in terminal output
node bin/env-check.js check --no-mask

# Generate a template; review it before sharing
node bin/env-check.js example -i docs/demo.env --stdout

# Compare key sets and set/empty states; different keys give exit code 1
node bin/env-check.js diff test/fixtures/a.env test/fixtures/b.env

node bin/env-check.js --help
```

`diff` compares keys and whether values are set, rather than value equality. Matching keys give exit `0`, even when their values differ.

### Library API

```javascript
import { validateEnv } from 'env-check';

const { config } = validateEnv({
  example: '.env.example',
  files: ['.env', '.env.local'],
  system: false,
  throwOnError: true
});

// Ports become numbers, booleans become booleans,
// and durations become milliseconds. Keep config private.
```

From a source checkout, import `./src/index.js`. The API also exports `loadEnv`, `loadSchema`, `parseDotenv`, `Schema`, diff helpers, and validation errors; see [src/index.js](src/index.js).

## Configuration

### Annotated `.env.example`

Place directives immediately above a variable, with no blank line between them:

```dotenv
# HTTP port
# @type port
# @default 3000
PORT=3000

# @type enum(development, staging, production)
# @default development
NODE_ENV=development

# @type string
# @required
# @secret
API_TOKEN=

# @type duration
# @default 15m
CACHE_TTL=15m

# @pattern /^[a-z-]+$/
SERVICE_NAME=demo-service
```

| Directive | Behavior |
| --- | --- |
| `@type` | `string`, `int`/`integer`, `port`, `bool`/`boolean`, `url`, `email`, `duration`, `enum(a,b)` |
| `@required` | Reject a missing or empty value after applying defaults |
| `@default value` | Fallback for missing or empty input |
| `@secret` | Mask the field in human-readable validation output |
| `@pattern /regex/` | Validate against a regular expression |

A nonempty, non-placeholder example value becomes a default unless `@default` overrides it. If any field has `@required`, only explicitly required fields are mandatory. Otherwise, fields without defaults are required. `@optional` alone does not override that fallback rule in 0.1.0.

Types accept safe integers, ports from 1 to 65535, boolean values `true/false`, `1/0`, `yes/no` (case-insensitive), URLs with a protocol, and common email formats. Durations accept milliseconds or units such as `500ms`, `10s`, `15m`, `2h`, `1d`, `1w`, `1y`, and `1h 30m`.

### JSON schema

Use `-s env.schema.json`. Supported fields are `properties`, `required`, per-property `type`, `enum`, `default`, `description`, `pattern`, `format` (`uri`, `url`, `email`), and `secret`/`x-secret`. See the runnable [demo schema](docs/env.schema.json).

This is a flat environment schema adapter, not a full JSON Schema validator. `$ref`, `allOf`, `minimum`, `maximum`, nested objects, and arrays are not enforced. Use `@type port` in an example schema for port range validation.

### Loading and CLI options

| Option | Default / behavior |
| --- | --- |
| `-e, --env` | `.env`; repeat to load more files |
| `-x, --example` | `.env.example` |
| `-s, --schema` | JSON schema instead of the example schema |
| `--no-system` | Disable merging `process.env`, which otherwise takes precedence |
| `--expand` | Expand `$VAR`, `${VAR}`, and `${VAR:-fallback}` |
| `--strict` | Treat unknown keys, duplicate keys, and Git tracking warnings as errors |
| `--no-git` | Skip the Git tracking check |
| `--quiet` | Suppress successful output; warnings and errors remain |
| `--no-mask` | Reveal non-secret values in terminal output |
| `--json` | Machine-readable result; **`check` includes raw config values, including secrets** |

The library accepts corresponding options (`files`, `example`, `schemaFile`, `system`, `expand`, `strict`, `checkGit`) plus `schema`, `env`, `cwd`, and `throwOnError`. Later files override earlier files; system environment values override files. Missing env files are skipped; a missing schema is an error.

| Exit | Meaning |
| --- | --- |
| `0` | Validation passed, template generated, or diff keys match |
| `1` | Validation failed, strict warnings occurred, or diff keys differ |
| `2` | Configuration, file, or command error |

## FAQ / Limitations

**Can I put JSON output in CI logs?** Treat `check --json` as sensitive: its `config` contains raw validated values. The library's `config` does too. Use human-readable reports for shared logs; secret fields there display `[SECRET len=N] ********`, even with `--no-mask`.

**How are secrets recognized?** Use `@secret` or JSON `secret: true`; names containing patterns such as `TOKEN`, `PASSWORD`, and `API_KEY` are also inferred. Explicitly mark sensitive URLs and unusual names. Masking is not a secret scanner, and value length remains visible. Review generated templates, especially retained `HOST`, `NODE_ENV`, and port defaults, before sharing.

**Why does strict mode warn about my shell variables?** `process.env` is merged by default and unknown keys generate warnings. Use `--no-system` for file-only validation. Expansion can still resolve references from `process.env`; leave `--expand` off for self-contained fixtures.

**Are all dotenv dialects and JSON Schema keywords supported?** No. The parser supports quotes, escapes, multiline values, comments, and `export` prefixes, but tolerates malformed lines and unclosed quotes. JSON Schema support is limited to the listed fields. Duplicate warnings concern repeated keys within a file, not intentional overrides across files.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Development checks:

```bash
npm ci --ignore-scripts
npm test
npm run lint
npm run typecheck
npm run demo
```

Tests print native coverage for `src/`, including CLI handlers, and enforce at least **85% line coverage**. CI runs on Linux, Windows, and macOS with Node.js 20 and 22. Report vulnerabilities according to [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE).
