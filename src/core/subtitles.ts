// WebVTT parsing, subtitle style model (port of prototype `subCss`) and simulated on-device generation.
import { MEDIA_BASE } from './config';

/** Prototype `LANGS`: code, English name, native name, sample line. */
export const LANGS: [string, string, string, string][] = [
  ['en', 'English', 'English', 'The tide does not keep secrets.'], ['de', 'German', 'Deutsch', 'Die Flut behält keine Geheimnisse.'],
  ['bn', 'Bangla', 'বাংলা', 'জোয়ার কোনো গোপন কথা রাখে না।'], ['ja', 'Japanese', '日本語', '潮は秘密を守らない。'],
  ['zh', 'Chinese', '中文', '潮水不会保守秘密。'], ['hi', 'Hindi', 'हिन्दी', 'ज्वार कोई राज़ नहीं रखता।'],
  ['es', 'Spanish', 'Español', 'La marea no guarda secretos.'], ['fr', 'French', 'Français', 'La marée ne garde pas de secrets.'],
  ['ar', 'Arabic', 'العربية', 'المدّ لا يحتفظ بالأسرار.'], ['ko', 'Korean', '한국어', '조수는 비밀을 지키지 않는다.'],
  ['ru', 'Russian', 'Русский', 'Прилив не хранит секретов.'], ['pt', 'Portuguese', 'Português', 'A maré não guarda segredos.'],
  ['tr', 'Turkish', 'Türkçe', 'Gelgit sır tutmaz.'], ['it', 'Italian', 'Italiano', 'La marea non custodisce segreti.'],
  ['id', 'Indonesian', 'Bahasa Indonesia', 'Pasang surut tidak menyimpan rahasia.'], ['ur', 'Urdu', 'اردو', 'جوار کوئی راز نہیں رکھتا۔'],
];
export const langOf = (c: string) => LANGS.find((x) => x[0] === c) || LANGS[0];

export interface Cue { start: number; end: number; text: string }

function ts(s: string): number {
  const p = s.trim().split(':').map(Number);
  if (p.some((n) => Number.isNaN(n))) return NaN;
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
}

export function parseVtt(text: string): Cue[] {
  const blocks = text.replace(/\r/g, '').split(/\n\n+/);
  if (!blocks[0] || !blocks[0].startsWith('WEBVTT')) return [];
  const out: Cue[] = [];
  for (const b of blocks.slice(1)) {
    const lines = b.split('\n').filter(Boolean);
    const i = lines.findIndex((l) => l.includes('-->'));
    if (i < 0) continue;
    const [a, z] = lines[i].split('-->');
    const start = ts(a), end = ts(z.trim().split(/\s+/)[0]);
    if (Number.isNaN(start) || Number.isNaN(end)) continue;
    out.push({ start, end, text: lines.slice(i + 1).join('\n') });
  }
  return out;
}

export const cueAt = (cues: Cue[], t: number) => cues.find((c) => t >= c.start && t < c.end) || null;

/** Build a VTT from the bundled sample line (fallback when the hosted file is unavailable). */
export function sampleVtt(code: string, dur = 120): string {
  const f = (s: number) => `00:${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}.000`;
  const parts = ['WEBVTT', ''];
  let n = 1;
  for (let s = 2; s < dur; s += 8) parts.push(String(n++), `${f(s)} --> ${f(Math.min(s + 5, dur))}`, langOf(code)[3], '');
  return parts.join('\n');
}

export const vttUrl = (code: string) => `${MEDIA_BASE}subtitles/${code}.vtt`;

/**
 * "Generate on this device". SIMULATED for the mock build: progress 0→100 % over ~4 s,
 * then the bundled VTT for that language (hosted copy, or the sample line as fallback).
 */
export async function simulateGeneration(
  code: string,
  onProgress: (pct: number) => void,
  o: { durationMs?: number; tick?: (ms: number) => Promise<void>; fetchText?: (u: string) => Promise<string> } = {},
): Promise<string> {
  const dur = o.durationMs ?? 4000, steps = 20;
  const tick = o.tick ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  for (let i = 1; i <= steps; i++) {
    await tick(dur / steps);
    onProgress(Math.round((i / steps) * 100));
  }
  try {
    const t = await (o.fetchText ?? ((u: string) => fetch(u).then((r) => (r.ok ? r.text() : Promise.reject(r.status)))))(vttUrl(code));
    if (parseVtt(t).length) return t;
  } catch {
    /* offline: fall back to the bundled line */
  }
  return sampleVtt(code);
}

/** Prototype `ONLINE`: fake online results for a title. */
export function onlineResults(title: string): { code: string; name: string; source: string; downloads: string }[] {
  const base = title.replace(/ /g, '.');
  return LANGS.slice(0, 10).flatMap(([c], i) => [
    { code: c, name: base + '.S01E02.1080p.WEB-DL', source: 'Source A', downloads: 12 - i + '.' + (i + 3) + 'k' },
    { code: c, name: base + '.S01E02.720p.HDTV', source: 'Source B', downloads: 4 + i + '.' + (9 - i) + 'k' },
  ]);
}

export interface SubStyle { size: number; color: string; stroke: 'none' | 'outline' | 'shadow' | 'glow'; w: number; place: 'top' | 'middle' | 'bottom'; off: number; bg: 0 | 40 | 80 }
export const SUB_DEFAULT: SubStyle = { size: 100, color: '#FFFFFF', stroke: 'outline', w: 2, place: 'bottom', off: 0, bg: 0 };
export const SUB_COLORS = ['#FFFFFF', '#FFEB3B', '#00E5FF', '#69F0AE', '#FF8A80', '#B388FF'];
export type SubMode = 'p' | 'l' | 'pip' | 'pv';

/** Port of prototype `subCss`: returns inline style strings for the cue box and the text span. */
export function subtitleCss(q: SubStyle, mode: SubMode): { pos: string; span: string } {
  const fs = ({ p: 11, l: 15, pip: 7, pv: 16 } as const)[mode] * q.size / 100;
  const w = q.w, c = q.color;
  let sh = 'none';
  if (q.stroke === 'outline') {
    const a: string[] = [];
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) if (x || y) a.push(`${x * w}px ${y * w}px 0 #000`);
    sh = a.join(',');
  } else if (q.stroke === 'shadow') sh = `${w}px ${w}px ${w * 2}px rgba(0,0,0,.95)`;
  else if (q.stroke === 'glow') sh = `0 0 ${w * 3}px ${c},0 0 ${w}px #000`;
  const baseB = ({ p: 30, l: 58, pip: 6, pv: 10 } as const)[mode], baseT = ({ p: 38, l: 46, pip: 18, pv: 10 } as const)[mode];
  const pos = q.place === 'bottom' ? `bottom:${baseB + q.off}px;top:auto` : q.place === 'top' ? `top:${baseT + q.off}px;bottom:auto` : `top:50%;bottom:auto;transform:translateY(-50%);margin-top:${-q.off}px`;
  return { pos: `${pos};font-size:${fs}px;color:${c};text-shadow:${sh}`, span: q.bg ? `background:rgba(0,0,0,${q.bg / 100});padding:2px 8px;border-radius:6px` : '' };
}
