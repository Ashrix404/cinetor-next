// CI-only stream probe (never run locally). Loads every embed server inside an <iframe> in real
// Google Chrome (H.264/AAC) and every live channel through hls.js, then prints what really plays.
// Run by .github/workflows/stream-probe.yml. Output: a markdown table on stdout + probe.json.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const BASE = process.env.PROBE_BASE || 'http://127.0.0.1:8080';
const MEDIA = /\.(m3u8|mp4|ts|m4s|mkv|webm)(\?|$)|mpegurl|video\//i;

const EMBEDS = JSON.parse(process.env.PROBE_EMBEDS || '[]');
const LIVE = JSON.parse(process.env.PROBE_LIVE || '[]');

async function probeEmbed(browser, url) {
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    viewport: { width: 412, height: 860 },
  });
  const page = await ctx.newPage();
  const media = new Set();
  let popups = 0;
  ctx.on('page', () => popups++);
  ctx.on('response', (r) => {
    const ct = r.headers()['content-type'] || '';
    if (MEDIA.test(r.url()) || /mpegurl|video\//i.test(ct)) media.add(r.status() + ' ' + r.url().slice(0, 90));
  });
  const row = { url, loaded: false, frames: 0, media: 0, video: 'none', popups: 0, err: '' };
  try {
    await page.goto(`${BASE}/frame.html?u=${encodeURIComponent(url)}`, { timeout: 20000 });
    await page.waitForTimeout(8000);
    // two clicks in the middle (most embeds need a user gesture to start)
    for (let i = 0; i < 2; i++) {
      await page.mouse.click(206, 230).catch(() => {});
      await page.waitForTimeout(4000);
      for (const p of ctx.pages()) if (p !== page) await p.close().catch(() => {});
    }
    await page.waitForTimeout(8000);
    row.frames = page.frames().length;
    row.loaded = page.frames().length > 1;
    let best = 'none';
    for (const f of page.frames()) {
      const v = await f.evaluate(() => [...document.querySelectorAll('video')].map((x) => `${x.readyState}/${x.currentTime.toFixed(1)}`)).catch(() => []);
      for (const s of v) if (best === 'none' || parseFloat(s.split('/')[1]) > parseFloat(best.split('/')[1] || '0')) best = s;
    }
    row.video = best;
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
  const r = await probeEmbed(browser, u);
  out.embeds.push(r);
  console.log(`EMBED | ${r.url} | frames=${r.frames} | media=${r.media} | video=${r.video} | popups=${r.popups} | ${r.err} | ${(r.mediaSample || []).join(' ; ')}`);
}
for (const c of LIVE) {
  const r = await probeLive(browser, c);
  out.live.push(r);
  console.log(`LIVE | ${r.name} | ${r.via} | ${r.result} | ${r.url}`);
}
await browser.close();
writeFileSync('probe.json', JSON.stringify(out, null, 2));
