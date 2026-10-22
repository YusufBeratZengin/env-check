/**
 * Command-line interface implementation for env-check.
 */

import fs from 'node:fs';
import path from 'node:path';
import { validateEnv, loadSchema } from './index.js';
import { diffEnvFiles, formatDiff } from './diff.js';
import { generateExample } from './generator.js';
import { maskValue } from './masker.js';

const VERSION = '0.1.0';

/**
 * Checks if color output should be enabled.
 */
function shouldEnableColor() {
  if (process.env.NO_COLOR || process.env.NODE_DISABLE_COLORS) return false;
  if (process.env.FORCE_COLOR) return true;
  return Boolean(process.stdout.isTTY);
}

const USE_COLOR = shouldEnableColor();

const style = {
  bold: (s) => (USE_COLOR ? `\x1b[1m${s}\x1b[22m` : s),
  dim: (s) => (USE_COLOR ? `\x1b[2m${s}\x1b[22m` : s),
  red: (s) => (USE_COLOR ? `\x1b[31m${s}\x1b[39m` : s),
  green: (s) => (USE_COLOR ? `\x1b[32m${s}\x1b[39m` : s),
  yellow: (s) => (USE_COLOR ? `\x1b[33m${s}\x1b[39m` : s),
  cyan: (s) => (USE_COLOR ? `\x1b[36m${s}\x1b[39m` : s)
};

/**
 * Prints help message.
 */
export function printHelp() {
  console.log(`
${style.bold('env-check')} ${style.dim(`v${VERSION}`)}
Validate environment variables and .env files against schemas without leaking secrets.

${style.bold('USAGE:')}
  env-check [command] [options]

${style.bold('COMMANDS:')}
  check                    Validate environment against schema (default)
  example                  Generate .env.example with stripped values
  diff <fileA> <fileB>     Diff keys only between two .env files

${style.bold('CHECK OPTIONS:')}
  -e, --env <path>         Path to .env file (can be repeated, e.g. -e .env -e .env.local)
  -x, --example <path>     Path to .env.example schema file [default: .env.example]
  -s, --schema <path>      Path to env.schema.json schema file
  --no-system              Do not merge process.env into verification
  --strict                 Treat warnings (unknown keys, git tracked, duplicates) as errors
  --no-mask                Reveal non-secret values (secrets remain masked)
  --expand                 Enable \${VAR} variable expansion
  --no-git                 Skip Git tracking checks
  --json                   Output results as JSON
  -q, --quiet              Suppress successful output, only show errors

${style.bold('EXAMPLE OPTIONS:')}
  -i, --input <path>       Source .env file [default: .env]
  -o, --output <path>      Destination file [default: .env.example]
  --stdout                 Print generated example to stdout

${style.bold('DIFF OPTIONS:')}
  --json                   Output diff as JSON

${style.bold('GLOBAL OPTIONS:')}
  -h, --help               Show this help message
  -v, --version            Show version number

${style.bold('EXIT CODES:')}
  0                        Success / all checks passed / keys match
  1                        Validation failed / keys differ / strict warnings
  2                        Configuration or file error
`);
}

/**
 * Simple argument parser for CLI flags.
 * @param {string[]} args
 */
export function parseArgs(args) {
  const flags = {
    envFiles: [],
    example: '.env.example',
    schemaFile: undefined,
    system: true,
    strict: false,
    noMask: false,
    expand: false,
    checkGit: true,
    json: false,
    quiet: false,
    input: '.env',
    output: '.env.example',
    stdout: false,
    help: false,
    version: false
  };

  const positional = [];
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    if (arg === '-h' || arg === '--help') {
      flags.help = true;
      i++;
    } else if (arg === '-v' || arg === '--version') {
      flags.version = true;
      i++;
    } else if (arg === '-e' || arg === '--env') {
      if (i + 1 < args.length) {
        flags.envFiles.push(args[i + 1]);
        i += 2;
      } else {
        i++;
      }
    } else if (arg === '-x' || arg === '--example') {
      if (i + 1 < args.length) {
        flags.example = args[i + 1];
        i += 2;
      } else {
        i++;
      }
    } else if (arg === '-s' || arg === '--schema') {
      if (i + 1 < args.length) {
        flags.schemaFile = args[i + 1];
        i += 2;
      } else {
        i++;
      }
    } else if (arg === '--no-system') {
      flags.system = false;
      i++;
    } else if (arg === '--system') {
      flags.system = true;
      i++;
    } else if (arg === '--strict') {
      flags.strict = true;
      i++;
    } else if (arg === '--no-mask') {
      flags.noMask = true;
      i++;
    } else if (arg === '--expand') {
      flags.expand = true;
      i++;
    } else if (arg === '--no-git') {
      flags.checkGit = false;
      i++;
    } else if (arg === '--json') {
      flags.json = true;
      i++;
    } else if (arg === '-q' || arg === '--quiet') {
      flags.quiet = true;
      i++;
    } else if (arg === '-i' || arg === '--input') {
      if (i + 1 < args.length) {
        flags.input = args[i + 1];
        i += 2;
      } else {
        i++;
      }
    } else if (arg === '-o' || arg === '--output') {
      if (i + 1 < args.length) {
        flags.output = args[i + 1];
        i += 2;
      } else {
        i++;
      }
    } else if (arg === '--stdout') {
      flags.stdout = true;
      i++;
    } else if (!arg.startsWith('-')) {
      positional.push(arg);
      i++;
    } else {
      // Unrecognized flag
      i++;
    }
  }

  return { flags, positional };
}

/**
 * Executes the `check` command.
 */
export async function runCheck(flags) {
  const files = flags.envFiles.length > 0 ? flags.envFiles : ['.env'];

  try {
    const result = validateEnv({
      files,
      example: flags.example,
      schemaFile: flags.schemaFile,
      system: flags.system,
      strict: flags.strict,
      expand: flags.expand,
      checkGit: flags.checkGit,
      throwOnError: false
    });

    if (flags.json) {
      console.log(JSON.stringify(result, null, 2));
      return result.valid ? 0 : 1;
    }

    if (!result.valid) {
      console.error(style.red(`[FAIL] Environment validation failed with ${result.errors.length} error(s):`));
      for (const err of result.errors) {
        const lineInfo = err.line ? ` (line ${err.line})` : '';
        console.error(`  ${style.red('x')} ${err.message}${style.dim(lineInfo)}`);
      }

      if (result.warnings.length > 0) {
        console.warn('');
        console.warn(style.yellow(`Warnings (${result.warnings.length}):`));
        for (const warn of result.warnings) {
          console.warn(`  ${style.yellow('!')} ${warn.message}`);
        }
      }

      return 1;
    }

    // Validation succeeded
    if (result.warnings.length > 0) {
      console.warn(style.yellow(`[WARN] Environment validated with ${result.warnings.length} warning(s):`));
      for (const warn of result.warnings) {
        console.warn(`  ${style.yellow('!')} ${warn.message}`);
      }
      console.warn('');
    }

    if (!flags.quiet) {
      console.log(style.green(`[PASS] Environment validation successful (${result.summary.passed}/${result.summary.total} variables verified).`));

      // Show verified variables safely
      const schema = flags.schemaFile
        ? loadSchema(flags.schemaFile)
        : loadSchema(flags.example);

      for (const [key, field] of schema.entries()) {
        const val = result.config[key];
        const display = maskValue(val, field.secret, flags.noMask);
        const secretTag = field.secret ? style.cyan(' [secret]') : '';
        console.log(`  ${style.green('ok')} ${key}=${display}${secretTag}`);
      }
    }

    return 0;
  } catch (err) {
    if (flags.json) {
      console.error(JSON.stringify({ error: err.message }, null, 2));
    } else {
      console.error(style.red(`[ERROR] ${err.message}`));
    }
    return 2;
  }
}

/**
 * Executes the `example` command.
 */
export async function runExample(flags) {
  const inputPath = path.resolve(process.cwd(), flags.input);

  if (!fs.existsSync(inputPath)) {
    console.error(style.red(`[ERROR] Input environment file not found: ${flags.input}`));
    return 2;
  }

  try {
    const inputContent = fs.readFileSync(inputPath, 'utf8');
    const generated = generateExample(inputContent);

    if (flags.stdout) {
      process.stdout.write(generated);
      return 0;
    }

    const outputPath = path.resolve(process.cwd(), flags.output);
    fs.writeFileSync(outputPath, generated, 'utf8');
    console.log(style.green(`[OK] Generated schema template written to ${flags.output} (all secrets stripped).`));
    return 0;
  } catch (err) {
    console.error(style.red(`[ERROR] Failed to generate example: ${err.message}`));
    return 2;
  }
}

/**
 * Executes the `diff` command.
 */
export async function runDiff(args, flags) {
  if (args.length < 2) {
    console.error(style.red('[ERROR] Diff command requires two file arguments: env-check diff <fileA> <fileB>'));
    return 2;
  }

  const fileA = path.resolve(process.cwd(), args[0]);
  const fileB = path.resolve(process.cwd(), args[1]);

  if (!fs.existsSync(fileA)) {
    console.error(style.red(`[ERROR] File not found: ${args[0]}`));
    return 2;
  }

  if (!fs.existsSync(fileB)) {
    console.error(style.red(`[ERROR] File not found: ${args[1]}`));
    return 2;
  }

  try {
    const result = diffEnvFiles(fileA, fileB);

    if (flags.json) {
      console.log(JSON.stringify(result, null, 2));
      return result.identical ? 0 : 1;
    }

    console.log(formatDiff({
      ...result,
      fileA: args[0],
      fileB: args[1]
    }));

    return result.identical ? 0 : 1;
  } catch (err) {
    console.error(style.red(`[ERROR] Diff failed: ${err.message}`));
    return 2;
  }
}

/**
 * Main CLI entry point.
 * @param {string[]} rawArgs
 * @returns {Promise<number>}
 */
export async function runCli(rawArgs) {
  const { flags, positional } = parseArgs(rawArgs);

  if (flags.version) {
    console.log(`env-check v${VERSION}`);
    return 0;
  }

  if (flags.help) {
    printHelp();
    return 0;
  }

  const command = positional[0];

  if (!command || command === 'check') {
    return await runCheck(flags);
  }

  if (command === 'example') {
    return await runExample(flags);
  }

  if (command === 'diff') {
    return await runDiff(positional.slice(1), flags);
  }

  console.error(style.red(`[ERROR] Unknown command: "${command}". Run "env-check --help" for usage.`));
  return 2;
}
