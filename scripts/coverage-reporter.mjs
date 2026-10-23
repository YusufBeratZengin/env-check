import { readdirSync } from 'node:fs';
import path from 'node:path';
import { tap } from 'node:test/reporters';

// Node 20 has no coverage include/threshold CLI flags. Filter the native
// coverage event so tests cannot inflate the source-only 85% line gate.
export default async function* reporter(source) {
  let lineCoverage;
  let missing = [];

  async function* events() {
    for await (const event of source) {
      if (event.type === 'test:coverage') {
        const summary = event.data.summary;
        const files = summary.files.filter(file =>
          path.dirname(file.path) === path.resolve('src')
        );
        const coveredFiles = new Set(files.map(file => path.basename(file.path)));
        missing = readdirSync('src').filter(file => file.endsWith('.js') && !coveredFiles.has(file));
        const totals = {};
        for (const kind of ['Line', 'Branch', 'Function']) {
          const total = files.reduce((sum, file) => sum + file[`total${kind}Count`], 0);
          const covered = files.reduce((sum, file) => sum + file[`covered${kind}Count`], 0);
          totals[`total${kind}Count`] = total;
          totals[`covered${kind}Count`] = covered;
          totals[`covered${kind}Percent`] = total === 0 ? 0 : covered / total * 100;
        }
        lineCoverage = totals.coveredLinePercent;
        event.data.summary = { ...summary, files, totals };
      }
      yield event;
    }
  }

  yield* tap(events());
  if (lineCoverage === undefined || lineCoverage < 85 || missing.length > 0) {
    process.exitCode = 1;
    yield `# Coverage gate FAILED: ${lineCoverage?.toFixed(2) ?? 'unavailable'}% lines (minimum 85%).\n`;
    if (missing.length) yield `# Source files without coverage: ${missing.join(', ')}\n`;
  } else {
    yield `# Coverage gate passed: ${lineCoverage.toFixed(2)}% source lines (minimum 85%).\n`;
  }
}
