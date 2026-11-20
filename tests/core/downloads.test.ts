import { describe, expect, it } from 'vitest';
import { fileName, relPath } from '../../src/core/downloads/naming';
import { makePdf } from '../../src/core/downloads/pdf';
import { planSegments } from '../../src/core/downloads/engine';

describe('download naming', () => {
  it('names videos, movies, comics, music', () => {
    expect(fileName('video', 'The Last: Orchard!', { season: 2, episode: 5, quality: 720 })).toBe('The.Last.Orchard.S2E5.720p.mp4');
    expect(fileName('video', 'Dune Part Two', { movie: true, quality: 1080 })).toBe('Dune.Part.Two.1080p.mp4');
    expect(fileName('comic', 'Ink/Samurai', { chapter: 214 })).toBe('InkSamurai - Chapter 214.pdf');
    expect(fileName('music', 'Static Bloom')).toBe('Static Bloom.mp3');
    expect(relPath('comic', 'a.pdf')).toBe('Download/Cinetor/Comics/a.pdf');
    expect(relPath('video', 'a.mp4')).toBe('Download/Cinetor/a.mp4');
  });
});

describe('makePdf', () => {
  it('starts with %PDF-1.4 and ends with %%EOF', () => {
    const p = makePdf('Ink (Samurai)', 3);
    expect(p.startsWith('%PDF-1.4')).toBe(true);
    expect(p.endsWith('%%EOF')).toBe(true);
    expect(p).toContain('/Count 3');
    expect(p).not.toContain('(Ink (Samurai))');
  });
});

describe('planSegments', () => {
  it('splits by connections and 256 KiB minimum', () => {
    expect(planSegments(1000, 16, true)).toEqual([[0, 999]]);
    const s = planSegments(10 * 1024 * 1024, 16, true);
    expect(s).toHaveLength(16);
    expect(s[0][0]).toBe(0);
    expect(s[s.length - 1][1]).toBe(10 * 1024 * 1024 - 1);
    expect(planSegments(10 * 1024 * 1024, 64, false)).toEqual([[0, 10 * 1024 * 1024 - 1]]);
  });
});
