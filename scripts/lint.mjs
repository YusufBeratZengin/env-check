import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const files = ['bin', 'src', 'scripts', 'test'].flatMap(directory =>
  readdirSync(directory)
    .filter(file => /\.(?:js|mjs)$/.test(file))
    .map(file => `${directory}/${file}`)
);

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(`Syntax checked ${files.length} JavaScript files.`);
