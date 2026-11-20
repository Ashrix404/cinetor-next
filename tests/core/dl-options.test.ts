import { describe, expect, it } from 'vitest';
import { audioOf, audios, buildOptions, fmtSize, pickFiles, qualities, rungOf } from '../../src/core/dl-options';
import type { MediaSrc } from '../../src/core/sources';

const f = (url: string, quality: number, name = '', size?: number, kind: MediaSrc['kind'] = 'mp4'): MediaSrc => ({ url, quality, name, kind, size });

describe('download options (real availability)', () => {
  const files = [
    f('https://a.example/Movie.2024.1080p.mkv', 1080, 'A 1080p', 2.1 * 1024 ** 3),
    f('https://b.example/Movie.2024.Hindi.1080p.mkv', 1080, 'B'),
    f('https://c.example/Movie.720p.mp4', 720, 'C', 900 * 1024 ** 2),
    f('https://d.example/x.mp4', 1072, 'D Dual Audio'),
    f('https://e.example/master.m3u8', 1080, 'HLS', undefined, 'hls'),
  ];
  it('merges files per quality rung + audio; HLS playlists are not offered', () => {
    const o = buildOptions(files);
    expect(o.map((x) => `${x.quality}/${x.audio}/${x.srcs.length}`)).toEqual(['1080/Original/1', '1080/Dual audio/1', '1080/Hindi/1', '720/Original/1']);
    expect(o[0].size).toBe(2.1 * 1024 ** 3);
    expect(qualities(o)).toEqual([1080, 720]);
    expect(audios(o, 1080)).toEqual(['Original', 'Dual audio', 'Hindi']);
  });
  it('reads the audio language from names and file names', () => {
    expect(audioOf({ name: '', url: 'https://x/Film.2023.Bengali.WEB-DL.mkv' })).toBe('Bangla');
    expect(audioOf({ name: '[Dual Audio] Hindi-English', url: 'https://x/a.mkv' })).toBe('Dual audio');
    expect(audioOf({ name: 'Mirror 2', url: 'https://x/a%20Tamil.mkv' })).toBe('Tamil');
    expect(audioOf({ name: '', url: 'https://x/a.mkv' })).toBe('Original');
  });
  it('picks the chosen quality + audio first, then the same quality, then the nearest', () => {
    const o = buildOptions(files);
    expect(pickFiles(o, 1080, 'Hindi').map((x) => x.name)).toEqual(['B', 'A 1080p', 'D Dual Audio', 'C']);
    expect(pickFiles(o, 480, 'Original').map((x) => x.name)[0]).toBe('C');
    expect(pickFiles([], 1080, 'Original')).toEqual([]);
  });
  it('snaps heights and formats sizes', () => {
    expect(rungOf(1072)).toBe(1080);
    expect(rungOf(800)).toBe(720);
    expect(rungOf(0)).toBe(720);
    expect(fmtSize(0)).toBe('~');
    expect(fmtSize(900 * 1024 ** 2)).toBe('900 MB');
    expect(fmtSize(2.1 * 1024 ** 3)).toBe('2.1 GB');
  });
});
