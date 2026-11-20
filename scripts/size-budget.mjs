// CI size + TV rule gate (docs/09-performance-budgets.md). Exits 1 on any violation.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { gzipSync } from 'node:zlib';

const KB = 1024;
const BUDGETS = {
  tv: { js: 60 * KB, css: 12 * KB },
  mobile: { js: 130 * KB, css: 30 * KB },
  desktop: { js: 150 * KB, css: 30 * KB },
};
const errors = [];

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const gz = (p) => gzipSync(readFileSync(p)).length;

for (const [shell, b] of Object.entries(BUDGETS)) {
  const files = walk(join('dist', shell));
  if (!files.length) { errors.push(`dist/${shell} missing (build first)`); continue; }
  const js = files.filter((f) => extname(f) === '.js').reduce((s, f) => s + gz(f), 0);
  const css = files.filter((f) => extname(f) === '.css').reduce((s, f) => s + gz(f), 0);
  const line = `${shell.padEnd(8)} js ${(js / KB).toFixed(1)} / ${b.js / KB} KB gz   css ${(css / KB).toFixed(1)} / ${b.css / KB} KB gz`;
  console.log(line);
  if (js > b.js) errors.push(`${shell} JS over budget: ${line}`);
  if (css > b.css) errors.push(`${shell} CSS over budget: ${line}`);
}

// TV CSS rules: forbidden properties outside /* splash-allowed */ ... /* end splash-allowed */ blocks.
const FORBIDDEN = [/backdrop-filter/, /(^|[^-])filter\s*:/, /box-shadow/, /transition/, /@keyframes/, /blur\(/, /@import\s+url\(/];
const tvCss = [...walk('dist/tv'), ...walk('src/shells/tv')].filter((f) => extname(f) === '.css');
for (const f of tvCss) {
  // Source CSS marks the splash with comments; minified dist CSS has no comments, so #splash rules are allowed there.
  const src = readFileSync(f, 'utf8')
    .replace(/\/\*\s*splash-allowed\s*\*\/[\s\S]*?\/\*\s*end splash-allowed\s*\*\//g, '')
    .replace(/#splash[^{}]*\{[^}]*\}/g, '');
  for (const re of FORBIDDEN) if (re.test(src)) errors.push(`TV CSS rule broken in ${f}: ${re}`);
}
for (const f of walk('dist/tv').filter((f) => ['.html', '.js'].includes(extname(f)))) {
  const s = readFileSync(f, 'utf8');
  if (/<iframe/i.test(s)) errors.push(`TV bundle contains <iframe: ${f}`);
  if (/fonts\.googleapis/.test(s)) errors.push(`TV bundle loads web fonts: ${f}`);
}

if (errors.length) {
  console.error('\nSIZE / TV RULE CHECK FAILED:\n- ' + errors.join('\n- '));
  process.exit(1);
}
console.log('size + TV rule check passed');
