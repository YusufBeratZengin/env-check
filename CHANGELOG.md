# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-10-22

### Added
- Zero-dependency dotenv parser with quote handling, escapes, multiline strings, export prefixes, and comments.
- Optional `${VAR}` and `${VAR:-default}` variable expansion.
- Duplicate key detection across `.env` files.
- Schema parser supporting inline annotations in `.env.example`:
  - `@type url|int|bool|enum(a,b)|email|port|duration|string`
  - `@required`
  - `@default <val>`
  - `@secret`
  - `@pattern /regex/`
- JSON Schema (`env.schema.json`) compatibility.
- Type validation and native coercion for `url`, `int`, `bool`, `enum`, `email`, `port`, `duration`, and `string`.
- Placeholder detection for leftover template values (`changeme`, `xxx`, `<...>`, etc.).
- Secret masking guarantee: secret values are never printed in logs, diffs, or error outputs.
- Git tracking detection via `git ls-files` to warn when `.env` files are accidentally committed.
- CLI commands:
  - `check`: Validate environment variables and files against schema with CI exit codes.
  - `example`: Generate clean `.env.example` templates with inferred types and stripped values.
  - `diff`: Compare keys between two `.env` files with zero secret exposure.
- Programmatic library API for runtime validation returning typed configurations.
- Test suite using Node.js built-in `node:test` runner.
