// Comics reader (prototype V.reader + updReader): vertical pages, "6 / 12" pill, progress line, prev/next, resume.
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Title } from '../../../core/tmdb';
import { I } from '../ui/icons';
import { BackTop, hueOf } from '../ui/common';
import { library, param, router, toast } from '../state';

const TOTAL = 12;
export function Reader() {
  const t = param<Title>('t')!, ch = param<number>('ch') || 214, h = hueOf(t.title);
  const last = library.lastPage(t.id, ch), start = last && last < TOTAL ? Math.max(1, last) : 1;
  const [pg, setPg] = useState(start);
  const [act, setAct] = useState(false);
  const rd = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    const el = rd.current?.querySelectorAll('.panelc')[start - 1] as HTMLElement | undefined;
    if (el && rd.current) rd.current.scrollTop = el.offsetTop;
  }, [ch]);
  const onScroll = () => {
    const r = rd.current;
    if (!r) return;
    const ps = r.querySelectorAll<HTMLElement>('.panelc'), mid = r.scrollTop + r.clientHeight / 2;
    let p = 1;
    ps.forEach((el, i) => el.offsetTop <= mid && (p = i + 1));
    if (r.scrollTop + r.clientHeight >= r.scrollHeight - 4) p = ps.length;
    setPg(p);
    if (p > library.lastPage(t.id, ch)) library.setPage(t.id, ch, p);
    setAct(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setAct(false), 900);
  };
  const goCh = (d: number) => {
    router.pop();
    router.push({ name: 'reader', params: { t, ch: ch - d } });
  };
  const panel = (i: number) => (
    <div class="panelc" key={i}>
      <i style={`left:6%;top:5%;width:88%;height:42%;background:hsl(${(h + ch * 7 + i * 30) % 360} 35% 80%);border:3px solid #111`} />
      <i style={`left:6%;top:51%;width:42%;height:44%;background:hsl(${(h + ch * 7 + i * 30 + 80) % 360} 30% 75%);border:3px solid #111`} />
      <i style={`left:52%;top:51%;width:42%;height:44%;background:hsl(${(h + ch * 7 + i * 30 + 160) % 360} 30% 78%);border:3px solid #111`} />
      <span style="left:14%;top:10%">Page {i}</span><b class="pn">{i}</b>
    </div>
  );
  return (
    <div style="position:relative;flex:1;display:flex;flex-direction:column;min-height:0">
      <BackTop t={`${t.title} · Ch. ${ch}`} extra={<div class="ibtn" onClick={() => toast('Reader settings')}><I n="cog-outline" /></div>} />
      <div class="rprog"><b style={`width:${(pg / TOTAL) * 100}%`} /></div>
      <div class="rd" ref={rd} onScroll={onScroll}>
        {Array.from({ length: TOTAL }, (_, i) => panel(i + 1))}
        <div style="padding:18px;display:flex;justify-content:space-between">
          <span class="btn tonal" onClick={() => goCh(-1)}><I n="chevron-left" /> Ch. {ch + 1}</span>
          <span class="btn" onClick={() => goCh(1)}>Ch. {ch - 1} <I n="chevron-right" /></span>
        </div>
      </div>
      <div class={'pgpill' + (act ? ' act' : '')}>{pg} / {TOTAL}</div>
    </div>
  );
}
Reader.bare = true;
