# Contributing to env-check

Thank you for your interest in contributing to `env-check`.

## Development Requirements

- Node.js >= 20.0.0
- Git

`env-check` has zero runtime dependencies and uses the native `node:test` runner. No package installation step is required.

## Workflow

1. Fork the repository on GitHub:
   https://github.com/YusufBeratZengin/env-check
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YusufBeratZengin/env-check.git
   cd env-check
   ```
3. Create a descriptive feature or bugfix branch:
   ```bash
   git checkout -b feat/your-feature-name
   ```
4. Make your changes adhering to existing code conventions.
5. Verify syntax and tests:
   ```bash
   npm run lint
   npm test
   ```
6. Commit your changes using Conventional Commits:
   - `feat: add support for custom duration units`
   - `fix: prevent secret leakage in schema parsing errors`
   - `test: add edge cases for multiline single-quoted values`
   - `docs: update Turkish README CLI flag references`
7. Push to your branch and submit a Pull Request.

## Guidelines

- Maintain zero runtime dependencies.
- Never log, display, or leak secret values under any circumstances.
- Write tests in `test/*.test.js` using `node:test` and `node:assert/strict`.
- Keep documentation up-to-date in both `README.md` and `README.tr.md`.
