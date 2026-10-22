#!/usr/bin/env node

/**
 * env-check CLI runner
 */

import { runCli } from '../src/cli.js';

const exitCode = await runCli(process.argv.slice(2));
process.exit(exitCode);
