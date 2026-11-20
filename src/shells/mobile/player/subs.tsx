// Subtitles UI (prototype subsBody, subsearchBody, substyleBody, genPill, startGen).
import { LANGS, langOf, onlineResults, simulateGeneration, subtitleCss, type SubStyle } from '../../../core/subtitles';
import { I } from '../ui/icons';
import { useStore } from '../ui/hooks';
import { setUi, ui } from '../state';
import { patch, pl, saveSeries } from './store';
import { setCues, subStyle } from './subs-overlay';

const tracksOf = (id: number) => pl.get().tracks[id] || [];

/** "Generate on this device" — SIMULATED for the mock build (core/subtitles.ts). */
export function startGen(code: string, src: 'auto' | 'online') {
  const s = pl.get(), id = s.st.titleId;
  if (s.gen || tracksOf(id).some((x) => x.code === code)) return;
  pl.set({ gen: { titleId: id, code, p: 0 } });
  simulateGeneration(code, (p) => pl.set({ gen: { titleId: id, code, p } }), { durationMs: src === 'auto' ? 4000 : 1600 }).then((vtt) => {
    setCues(code, vtt);
    const cur = pl.get();
    pl.set({ gen: null, tracks: { ...cur.tracks, [id]: [...(cur.tracks[id] || []), { code, src }] } });
    if (cur.st.titleId === id) {
      patch({ sub: code });
      saveSeries();
    }
  });
}

export function GenPill() {
  const g = pl.get().gen;
  if (!g || g.titleId !== pl.get().st.titleId) return null;
  return <div class="genpill"><I n="creation" /><b class="gp">{Math.round(g.p)}%</b></div>;
}

export function SRowOpt({ ic, txt, on, act }: { ic: string; txt: preact.ComponentChildren; on?: boolean; act: () => void }) {
  return (
    <div class={'opt' + (on ? ' on' : '')} onClick={act}>
      <span style={`display:flex;align-items:center;gap:12px;color:${on ? 'var(--primary)' : 'var(--on)'}`}><I n={ic} />{txt}</span>
      {on && <I n="check" />}
    </div>
  );
}

const pick = (code: string) => {
  patch({ sub: code });
  saveSeries();
  setUi({ sheet: false });
};

export function SubsBody() {
  const s = pl.get(), id = s.st.titleId, tr = tracksOf(id), g = s.gen;
  return (
    <>
      <div class="shd">
        <I n="subtitles-outline" /><span class="grow" />
        <span class="pi sm" onClick={() => setUi({ sheet: 'substyle' })}><I n="format-size" /></span>
        <span class="pi sm" onClick={() => setUi({ sheet: 'subsearch', sq: null })}><I n="magnify" /></span>
      </div>
      <SRowOpt ic="close-circle-outline" txt="Off" on={s.st.sub === 'Off'} act={() => pick('Off')} />
      {tr.map((x) => (
        <SRowOpt key={x.code} ic={x.src === 'auto' ? 'creation' : x.src === 'online' ? 'cloud-download-outline' : 'file-check-outline'} txt={<>{langOf(x.code)[1]} <small style="display:inline">{langOf(x.code)[2]}</small></>} on={s.st.sub === x.code} act={() => pick(x.code)} />
      ))}
      {!tr.length && <div class="nosub"><I n="subtitles-outline" /><span>No subtitles found for this title. Tap a language below to generate them.</span></div>}
      <div class="cap"><I n="cellphone-check" /><span>Generate on this device<small>No upload. Works offline.</small></span></div>
      <div class="lgrid">
        {LANGS.map(([c, n, nat]) => {
          const has = tr.some((x) => x.code === c), gen = g && g.titleId === id && g.code === c;
          return (
            <span key={c} class={'lg' + (has ? ' has' : '')} onClick={() => (has ? pick(c) : startGen(c, 'auto'))}>
              {gen ? <span class="gpc">{Math.round(g!.p)}%</span> : has ? <I n="check" /> : <I n="creation" />} {n}{nat !== n && <> <small>{nat}</small></>}
            </span>
          );
        })}
      </div>
      <SRowOpt ic="magnify" txt="Search online" act={() => setUi({ sheet: 'subsearch', sq: null })} />
    </>
  );
}

export function SubSearchBody() {
  const s = pl.get(), u = ui.get(), q = u.sq == null ? s.st.title : u.sq, tr = tracksOf(s.st.titleId);
  const toks = q.toLowerCase().split(/\s+/).filter(Boolean);
  const res = onlineResults(s.st.title).filter((o) => {
    const hay = (o.name + ' ' + langOf(o.code)[1] + ' ' + langOf(o.code)[2] + ' ' + o.source).toLowerCase();
    return toks.every((k) => hay.includes(k));
  }).slice(0, 14);
  return (
    <>
      <div class="shd">
        <span class="pi sm" onClick={() => setUi({ sheet: 'subs' })}><I n="arrow-left" /></span>
        <div class="field sqf"><I n="magnify" /><input value={q} placeholder="Search subtitles online" autocomplete="off" autoFocus onInput={(e) => setUi({ sq: (e.target as HTMLInputElement).value })} /></div>
      </div>
      <div>
        {res.length ? res.map((o, i) => {
          const g = s.gen && s.gen.code === o.code, has = tr.some((x) => x.code === o.code);
          return (
            <div class="opt" key={i} onClick={() => (has ? pick(o.code) : startGen(o.code, 'online'))}>
              <span style="display:flex;flex-direction:column;gap:2px;color:var(--on)"><span>{langOf(o.code)[1]} <small style="display:inline;color:var(--on-var)">{langOf(o.code)[2]}</small></span><small>{o.name} · {o.source}</small></span>
              <span style="display:flex;align-items:center;gap:6px;color:var(--on-var);font-size:12px">{g ? <span class="gpc">{Math.round(s.gen!.p)}%</span> : has ? <I n="check" /> : <><I n="cloud-download-outline" />{o.downloads}</>}</span>
            </div>
          );
        }) : <div class="nosub"><I n="magnify-close" /><span>No subtitles found online</span></div>}
      </div>
    </>
  );
}

export function SubStyleBody() {
  const q = useStore(subStyle), pv = subtitleCss(q, 'pv');
  const set = (p: Partial<SubStyle>) => subStyle.set(p);
  const seg = <K extends keyof SubStyle>(k: K, o: [SubStyle[K], string][]) => (
    <div class="seg3">{o.map(([v, l]) => <span key={l} class={v === q[k] ? 'on' : ''} onClick={() => set({ [k]: v } as Partial<SubStyle>)}>{l}</span>)}</div>
  );
  const step = (k: 'size' | 'w' | 'off', d: number, lo: number, hi: number, u: string) => (
    <span class="stp">
      <b onClick={() => set({ [k]: Math.max(lo, Math.min(hi, q[k] - d)) })}><I n="minus" /></b>{q[k]}{u}
      <b onClick={() => set({ [k]: Math.max(lo, Math.min(hi, q[k] + d)) })}><I n="plus" /></b>
    </span>
  );
  const code = pl.get().st.sub;
  return (
    <>
      <div class="sprev"><div class="sub" style={pv.pos}><span style={pv.span}>{langOf(code === 'Off' ? 'en' : code)[3]}</span></div></div>
      <div class="srw2"><label>Size</label>{step('size', 10, 50, 220, '%')}</div>
      <div class="srw2"><label>Color</label><div class="swc">{['#FFFFFF', '#FFEB3B', '#69F0AE', '#40C4FF', '#FF80AB', '#FFAB40'].map((c) => <i key={c} class={q.color === c ? 'on' : ''} style={`background:${c}`} onClick={() => set({ color: c })} />)}</div></div>
      <div class="srw2"><label>Stroke</label>{seg('stroke', [['none', 'None'], ['outline', 'Outline'], ['shadow', 'Shadow'], ['glow', 'Glow']])}</div>
      <div class="srw2"><label>Stroke width</label>{step('w', 1, 0, 5, 'px')}</div>
      <div class="srw2"><label>Placement</label>{seg('place', [['top', 'Top'], ['middle', 'Middle'], ['bottom', 'Bottom']])}</div>
      <div class="srw2"><label>Offset</label>{step('off', 4, -40, 80, 'px')}</div>
      <div class="srw2"><label>Background</label>{seg('bg', [[0, 'None'], [40, 'Soft'], [80, 'Solid']])}</div>
    </>
  );
}
