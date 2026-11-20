// Collects signed APKs into out/apk, writes out/latest.json + out/RELEASE_NOTES.md, copies
// latest.json and version.json into dist/site (docs/08 §release.yml, §latest.json).
// usage: node scripts/collect-release.mjs <version> <baseCode>
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const [version, base] = process.argv.slice(2);
if (!version || !base) throw new Error('usage: collect-release.mjs <version> <baseCode>');
const REPO = 'https://github.com/Ashrix404/cinetor-releases/releases/download/v' + version + '/';
const ABIS = ['arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64', 'universal'];
mkdirSync('out/apk', { recursive: true });

const apk = {};
for (const flavor of ['phone', 'tv']) {
  apk[flavor] = {};
  for (const abi of ABIS) {
    const src = `android/app/build/outputs/apk/${flavor}/release/app-${flavor}-${abi}-release.apk`;
    if (!existsSync(src)) throw new Error('missing ' + src);
    const name = `cinetor-${flavor}-${abi}-v${version}.apk`;
    copyFileSync(src, 'out/apk/' + name);
    const buf = readFileSync(src);
    apk[flavor][abi] = { url: REPO + name, sha256: createHash('sha256').update(buf).digest('hex'), size: statSync(src).size };
  }
}

let notes = '';
try {
  const tags = execSync('git tag --sort=-creatordate', { encoding: 'utf8' }).split('\n').filter(Boolean);
  const prev = tags.find((t) => t !== 'v' + version);
  const range = prev ? `${prev}..HEAD` : 'HEAD';
  notes = execSync(`git log ${range} --pretty=format:%s`, { encoding: 'utf8' })
    .split('\n').filter((l) => /^(feat|fix)(\(.+\))?:/.test(l)).map((l) => '- ' + l.replace(/\s*\(#\d+\)$/, '')).join('\n');
} catch {
  /* shallow clone: no notes */
}
if (!notes) notes = '- Bug fixes and improvements';
writeFileSync('out/RELEASE_NOTES.md', `# Cinetor ${version}\n\n${notes}\n`);

const latest = {
  version, versionCode: Number(base), minVersionCode: Number(process.env.MIN_VERSION_CODE || 0),
  notes: notes.split('\n').slice(0, 12).join('\n'), publishedAt: new Date().toISOString(), apk, web: { version },
};
writeFileSync('out/latest.json', JSON.stringify(latest, null, 1) + '\n');
mkdirSync('dist/site', { recursive: true });
copyFileSync('out/latest.json', 'dist/site/latest.json');
writeFileSync('dist/site/version.json', JSON.stringify({ version }) + '\n');
console.log(`collected ${Object.keys(apk).length * ABIS.length} APKs for v${version} (code ${base})`);
