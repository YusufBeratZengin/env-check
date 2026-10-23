# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-10-23

### Added
- Zero-dependency dotenv parser with quote handling, escapes, multiline strings, export prefixes, and comments.
- Optional `${VAR}` and `${VAR:-default}` variable expansion.
- Duplicate key detection within each `.env` file, with ordered overrides when loading multiple files.
- Schema parser supporting inline annotations in `.env.example`:
  - `@type url|int|bool|enum(a,b)|email|port|duration|string`
  - `@required`
  - `@default <val>`
  - `@secret`
  - `@pattern /regex/`
- Support for a flat subset of JSON Schema through `env.schema.json`, including types, required fields, defaults, enums, formats, and patterns.
- Type validation and native coercion for `url`, `int`, `bool`, `enum`, `email`, `port`, `duration`, and `string`.
- Placeholder detection for leftover template values (`changeme`, `xxx`, `<...>`, etc.).
- Secret field masking in human-readable validation reports, including with `--no-mask`; key-only diffs do not display values. JSON results and the library's `config` contain raw values and must be kept private.
- Git tracking detection via `git ls-files` to warn when `.env` files are accidentally committed.
- CLI commands:
  - `check`: Validate environment variables and files against schema with CI exit codes.
  - `example`: Generate clean `.env.example` templates with inferred types and stripped values.
  - `diff`: Compare keys between two `.env` files with zero secret exposure.
- Programmatic library API for runtime validation returning typed configurations.
- Test suite using Node.js built-in `node:test` runner.
- Native source coverage reporting with an 85% line coverage gate, JavaScript type checking, and syntax checks for every JavaScript file.
- Reproducible terminal SVG demo and matching English and Turkish getting-started guides.
- CI on Linux, Windows, and macOS with Node.js 20 and 22, weekly dependency updates, CodeQL analysis, and issue/PR templates.
