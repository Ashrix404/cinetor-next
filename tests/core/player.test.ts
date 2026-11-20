import { describe, expect, it } from 'vitest';
import { clipFor, fmtTime, initialState, lock, next, pip, prev, seekBy, setQuality } from '../../src/core/player-model';
import { cueAt, parseVtt, sampleVtt, simulateGeneration, subtitleCss, SUB_DEFAULT } from '../../src/core/subtitles';

const tv = () => initialState({ titleId: 1, title: 'Show', mediaType: 'tv', dur: 100 });

describe('player model', () => {
  it('next crosses seasons and stops after the last episode', () => {
    let s = { ...tv(), episode: 6 };
    s = next(s);
    expect([s.season, s.episode]).toEqual([2, 1]);
    s = next({ ...s, season: 3, episode: 6 });
    expect(s.playing).toBe(false);
    expect(s.pos).toBe(100);
  });
  it('prev restarts after 8 s, else goes back across seasons', () => {
    expect(prev({ ...tv(), episode: 3, pos: 20 }).episode).toBe(3);
    const p = prev({ ...tv(), season: 2, episode: 1, pos: 2 });
    expect([p.season, p.episode]).toEqual([1, 6]);
    expect(prev({ ...tv(), season: 1, episode: 1, pos: 2 })).toMatchObject({ season: 1, episode: 1, pos: 0 });
  });
  it('uses real season sizes when known', () => {
    const s = next({ ...tv(), episode: 2 }, [2, 10]);
    expect([s.season, s.episode]).toEqual([2, 1]);
  });
  it('seekBy clamps, lock and pip toggle', () => {
    expect(seekBy({ ...tv(), pos: 95 }, 10).pos).toBe(100);
    expect(seekBy({ ...tv(), pos: 5 }, -10).pos).toBe(0);
    expect(lock(tv()).locked).toBe(true);
    expect(pip(lock(tv())).mode).toBe('pip');
    expect(pip(lock(tv())).locked).toBe(false);
    expect(setQuality(tv(), 480).quality).toBe(480);
  });
  it('maps quality to mock clips', () => {
    expect(clipFor(2160)).toBe('clip-1080p.mp4');
    expect(clipFor(720)).toBe('clip-720p.mp4');
    expect(clipFor(360)).toBe('clip-480p.mp4');
    expect(fmtTime(3725)).toBe('1:02:05');
    expect(fmtTime(65)).toBe('1:05');
  });
});

describe('subtitles', () => {
  it('parses VTT', () => {
    const cues = parseVtt('WEBVTT\nLanguage: en\n\n1\n00:00:02.000 --> 00:00:07.000\nHello\n\n2\n00:01.500 --> 00:03.000 align:start\nA\nB\n');
    expect(cues).toEqual([{ start: 2, end: 7, text: 'Hello' }, { start: 1.5, end: 3, text: 'A\nB' }]);
    expect(cueAt(cues, 2.5)?.text).toBe('Hello');
    expect(parseVtt('nope')).toEqual([]);
  });
  it('sample VTT round-trips', () => {
    expect(parseVtt(sampleVtt('de'))[0].text).toBe('Die Flut behält keine Geheimnisse.');
  });
  it('simulated generation reports progress to 100 and returns VTT', async () => {
    const seen: number[] = [];
    const vtt = await simulateGeneration('bn', (p) => seen.push(p), { tick: async () => {}, fetchText: async () => { throw new Error('offline'); } });
    expect(seen[seen.length - 1]).toBe(100);
    expect(parseVtt(vtt)[0].text).toBe('জোয়ার কোনো গোপন কথা রাখে না।');
  });
  it('subtitleCss matches the prototype', () => {
    const c = subtitleCss(SUB_DEFAULT, 'p');
    expect(c.pos.startsWith('bottom:30px;top:auto;font-size:11px;color:#FFFFFF;text-shadow:-2px -2px 0 #000')).toBe(true);
    expect(c.span).toBe('');
    const g = subtitleCss({ ...SUB_DEFAULT, stroke: 'glow', place: 'middle', off: 10, bg: 40, size: 200 }, 'l');
    expect(g.pos).toBe('top:50%;bottom:auto;transform:translateY(-50%);margin-top:-10px;font-size:30px;color:#FFFFFF;text-shadow:0 0 6px #FFFFFF,0 0 2px #000');
    expect(g.span).toBe('background:rgba(0,0,0,0.4);padding:2px 8px;border-radius:6px');
  });
});
