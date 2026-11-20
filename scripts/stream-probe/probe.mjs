// CI-only stream probe (never run locally). Loads every embed server inside an <iframe> in real
// Google Chrome (H.264/AAC) and every live channel through hls.js, then prints what really plays.
// Run by .github/workflows/stream-probe.yml. Output: a markdown table on stdout + probe.json.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = process.env.PROBE_BASE || 'http://127.0.0.1:8080';
const MEDIA = /\.(m3u8|mp4|ts|m4s|mkv|webm)(\?|$)|mpegurl|video\//i;

const EMBEDS = JSON.parse(process.env.PROBE_EMBEDS || '[]');
const LIVE = JSON.parse(process.env.PROBE_LIVE || '[]');

// Modes (PROBE_MODES, comma separated):
// - chrome:  mobile Chrome UA (what the web app on a phone sees)
// - webview: the real Android System WebView UA ("; wv)" + "Version/4.0"), i.e. the APK before the fix
// - apk:     the WebView UA + the embed guard the APK injects into every frame (res/raw/embed_shim.js)
// - sandbox: mobile Chrome UA, iframe with the sandbox the web app uses for sandbox-safe servers
const CHROME_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const WEBVIEW_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36';
const SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-presentation allow-pointer-lock allow-orientation-lock';
const SHIM = readFileSync(new URL('../../android/app/src/main/res/raw/embed_shim.js', import.meta.url), 'utf8');
const BLOCKED = /In-App Browser Detected|Open in External Browser|Sandbox not allowed|does not work inside embedded browsers|sandbox(ed)? (is )?not allowed|remove .?sandbox/i;
const MODES = (process.env.PROBE_MODES || 'chrome').split(',').map((x) => x.trim()).filter(Boolean);

async function probeEmbed(browser, url, mode) {
  const ctx = await browser.newContext({ userAgent: mode === 'chrome' || mode === 'sandbox' ? CHROME_UA : WEBVIEW_UA, viewport: { width: 412, height: 860 } });
  if (mode === 'apk') await ctx.addInitScript(SHIM);
  const page = await ctx.newPage();
  const media = new Set();
  let popups = 0;
  ctx.on('page', () => popups++);
  ctx.on('response', (r) => {
    const ct = r.headers()['content-type'] || '';
    if (MEDIA.test(r.url()) || /mpegurl|video\//i.test(ct)) media.add(r.status() + ' ' + r.url().slice(0, 90));
  });
  const row = { url, mode, loaded: false, frames: 0, media: 0, video: 'none', popups: 0, topNav: '', blocked: '', msgs: '', err: '' };
  const frameUrl = `${BASE}/frame.html?u=${encodeURIComponent(url)}` + (mode === 'sandbox' ? `&sandbox=${encodeURIComponent(SANDBOX)}` : '');
  try {
    await page.goto(frameUrl, { timeout: 20000 });
    await page.waitForTimeout(8000);
    // two clicks in the middle (most embeds need a user gesture to start)
    for (let i = 0; i < 2; i++) {
      await page.mouse.click(206, 230).catch(() => {});
      await page.waitForTimeout(4000);
      for (const p of ctx.pages()) if (p !== page) await p.close().catch(() => {});
    }
    await page.waitForTimeout(8000);
    if (!page.url().startsWith(BASE)) row.topNav = page.url().slice(0, 80);
    row.frames = page.frames().length;
    row.loaded = page.frames().length > 1;
    let best = 'none';
    for (const f of page.frames()) {
      const v = await f.evaluate(() => [...document.querySelectorAll('video')].map((x) => `${x.readyState}/${x.currentTime.toFixed(1)}`)).catch(() => []);
      for (const s of v) if (best === 'none' || parseFloat(s.split('/')[1]) > parseFloat(best.split('/')[1] || '0')) best = s;
      const t = await f.evaluate(() => (document.body ? document.body.innerText : '').slice(0, 4000)).catch(() => '');
      const m = f !== page.mainFrame() && t.match(BLOCKED);
      if (m && !row.blocked) row.blocked = m[0];
      if (!row.blocked && /\/blocked(\?|$)/.test(f.url())) row.blocked = 'redirect ' + f.url().slice(0, 60);
    }
    row.video = best;
    row.msgs = (await page.evaluate(() => (window.__msgs || []).join(' ')).catch(() => '')) || '';
  } catch (e) {
    row.err = String(e.message || e).slice(0, 80);
  }
  row.media = media.size;
  row.mediaSample = [...media].slice(0, 3);
  row.popups = popups;
  await ctx.close();
  return row;
}

async function probeLive(browser, [name, url, via]) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const row = { name, url, via, result: 'timeout' };
  try {
    await page.goto(`${BASE}/live.html?via=${via}&u=${encodeURIComponent(url)}`, { timeout: 20000 });
    await page.waitForFunction(() => window.__probe && window.__probe.done, null, { timeout: 30000 });
    row.result = await page.evaluate(() => window.__probe.result);
  } catch (e) {
    row.result = 'timeout';
  }
  await ctx.close();
  return row;
}

const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const out = { embeds: [], live: [] };
for (const u of EMBEDS) {
  for (const mode of MODES) {
    const r = await probeEmbed(browser, u, mode);
    out.embeds.push(r);
    console.log(`EMBED | ${mode} | ${r.url} | frames=${r.frames} | media=${r.media} | video=${r.video} | popups=${r.popups} | blocked=${r.blocked} | msgs=${r.msgs} | top=${r.topNav} | ${r.err} | ${(r.mediaSample || []).join(' ; ')}`);
  }
}
for (const c of LIVE) {
  const r = await probeLive(browser, c);
  out.live.push(r);
  console.log(`LIVE | ${r.name} | ${r.via} | ${r.result} | ${r.url}`);
}
await browser.close();
writeFileSync('probe.json', JSON.stringify(out, null, 2));
