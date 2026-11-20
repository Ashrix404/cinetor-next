// Our own subtitle renderer (not the browser's), so the style editor works everywhere.
import { useEffect, useState } from 'preact/hooks';
import { cueAt, parseVtt, subtitleCss, SUB_DEFAULT, vttUrl, sampleVtt, type Cue, type SubMode, type SubStyle } from '../../../core/subtitles';
import { createStore } from '../../../core/store';
import { useStore } from '../ui/hooks';
import { pl, ptime } from './store';

export const subStyle = createStore<SubStyle>('substyle', { ...SUB_DEFAULT }, true);

const cues = new Map<string, Cue[]>();
const pending = new Set<string>();
export function setCues(code: string, vtt: string) {
  cues.set(code, parseVtt(vtt));
}
function ensure(code: string, done: () => void) {
  if (cues.has(code) || pending.has(code)) return;
  pending.add(code);
  fetch(vttUrl(code))
    .then((r) => (r.ok ? r.text() : Promise.reject(r.status)))
    .catch(() => sampleVtt(code))
    .then((t) => {
      setCues(code, t);
      pending.delete(code);
      done();
    });
}

export function SubOverlay({ mode }: { mode: SubMode }) {
  const s = pl.get();
  const t = useStore(ptime);
  const q = useStore(subStyle);
  const [, bump] = useState(0);
  const code = s.st.sub;
  useEffect(() => {
    if (code !== 'Off') ensure(code, () => bump((n) => n + 1));
  }, [code]);
  if (code === 'Off' || s.st.locked) return null;
  const c = cueAt(cues.get(code) || [], t.pos - s.st.subDelayMs / 1000);
  if (!c) return null;
  const css = subtitleCss(q, mode);
  return <div class="sub" style={css.pos}><span style={css.span}>{c.text}</span></div>;
}
