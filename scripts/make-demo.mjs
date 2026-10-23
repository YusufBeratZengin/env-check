import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Invoke the real CLI handler and capture its output without a child shell.
// The public fixture and --stdout avoid reading ambient configuration or
// writing a generated schema over a user's files.
process.chdir(fileURLToPath(new URL('..', import.meta.url)));
process.env.NO_COLOR = '1';
const { runCli } = await import('../src/cli.js');
const args = ['example', '-i', 'docs/demo.env', '--stdout'];
const command = `node bin/env-check.js ${args.join(' ')}`;
const chunks = [];
const originalWrite = process.stdout.write;
let status;
try {
  process.stdout.write = chunk => { chunks.push(String(chunk)); return true; };
  status = await runCli(args);
} finally {
  process.stdout.write = originalWrite;
}
if (status !== 0) throw new Error(`Demo command exited with ${status}`);

const output = chunks.join('').trimEnd().split(/\r?\n/);
const lines = [`$ ${command}`, '', ...output.slice(0, 22)];
if (output.length > 22) lines.push('…');
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const width = 900;
const height = 86 + lines.length * 23;
const rows = lines.map((line, index) => {
  const color = index === 0 ? '#a5f3fc' : line.startsWith('#') ? '#94a3b8' : '#e2e8f0';
  return `  <text x="28" y="${82 + index * 23}" fill="${color}">${escape(line)}</text>`;
});
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">env-check: generate an environment template</title>
  <desc id="desc">Real CLI output from a public demo fixture. Safe defaults are retained and the demo token is stripped.</desc>
  <rect width="${width}" height="${height}" rx="14" fill="#0f172a"/>
  <path d="M14 0h872a14 14 0 0 1 14 14v32H0V14A14 14 0 0 1 14 0" fill="#1e293b"/>
  <circle cx="26" cy="23" r="6" fill="#fb7185"/>
  <circle cx="46" cy="23" r="6" fill="#fbbf24"/>
  <circle cx="66" cy="23" r="6" fill="#4ade80"/>
  <g font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="14" xml:space="preserve">
${rows.join('\n')}
  </g>
</svg>
`;
mkdirSync('docs', { recursive: true });
writeFileSync('docs/demo.svg', svg);
console.log(`Generated docs/demo.svg from: ${command} (${lines.length} terminal lines).`);
