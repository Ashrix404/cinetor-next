// Assembles dist/site/ (docs/02-architecture.md "Web deploy layout").
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const site = 'dist/site';
rmSync(site, { recursive: true, force: true });
mkdirSync(site, { recursive: true });
cpSync('dist/mobile', join(site, 'm'), { recursive: true });
cpSync('dist/desktop', join(site, 'd'), { recursive: true });
for (const f of readdirSync('web')) cpSync(join('web', f), join(site, f), { recursive: true });

const version = process.env.VITE_APP_VERSION || '0.0.0-dev';
writeFileSync(join(site, 'version.json'), JSON.stringify({ version }) + '\n');
const sw = join(site, 'sw.js');
if (existsSync(sw)) {
  const { readFileSync } = await import('node:fs');
  writeFileSync(sw, readFileSync(sw, 'utf8').replaceAll('__VERSION__', version));
}
console.log(`site assembled (version ${version})`);
