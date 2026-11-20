// App frame pieces: splash (playSplash), bottom nav (navBar), side menu (drawerHtml), toast, PIN keypad (pinHtml).
import { useEffect, useState } from 'preact/hooks';
import { pinPress, pinTitle } from '../../core/pin';
import { I, SV } from './ui/icons';
import { adult, cur, nav, router, setUi, toast, ui, on } from './state';

const NAV: [string, string, string][] = [['home', 'home', 'Home'], ['anime', 'anime', 'Anime'], ['drama', 'drama', 'Drama'], ['tv', 'tv', 'TV'], ['settings', 'cog-outline', 'Settings']];

export function NavBar({ tab }: { tab: string | null }) {
  const labels = on.get().tbl;
  return (
    <div class="nav">
      {NAV.map(([k, ic, l]) => (
        <div key={k} class={k === tab ? 'on' : ''} onClick={() => nav(k, {}, { root: true })}>
          {k === 'settings' ? <I n={ic} /> : <i><SV n={ic} /></i>}
          {labels && l}
        </div>
      ))}
    </div>
  );
}

const DRAWER: [string, string, string, string][] = [
  ['music', 'music-note', 'Music', 'Songs, playlists, podcasts'],
  ['comics', 'book-open-page-variant', 'Comics', 'Manga, Manhwa, Manhua'],
  ['adult', 'shield-lock-outline', 'Adult Section', 'PIN protected'],
];

export function Drawer() {
  const u = ui.get();
  if (!u.drawer) return null;
  const v = cur().name;
  const close = () => {
    setUi({ drawerOut: true });
    setTimeout(() => setUi({ drawer: false, drawerOut: false }), 230);
  };
  const out = u.drawerOut ? ' out' : '';
  return (
    <>
      <div class={'scrim dscrim' + out} onClick={close} />
      <aside class={'dwr' + out} aria-label="Menu">
        <div class="dhd">
          <span class="dlogo"><SV n="mark" /></span>
          <div class="dbr"><b>CINE<span>TOR</span></b><small>Watch · Read · Listen</small></div>
          <span class="dx" role="button" aria-label="Close menu" onClick={close}><I n="close" /></span>
        </div>
        <div class="dscroll">
          <div class="dgrp">
            <div class="dlbl">Discover</div>
            {DRAWER.filter((x) => x[0] !== 'adult' || adult.isOn()).map(([k, ic, t, d]) => (
              <div key={k} class={'dit' + (k === v ? ' on' : '')} onClick={() => nav(k, {}, { root: true })}>
                <span class="dic"><I n={ic} /></span>
                <span class="dtx"><b>{t}</b><small>{d}</small></span>
                {k === 'adult' ? <em class="d18">18+</em> : <span class="dch"><I n="chevron-right" /></span>}
              </div>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}

export function Toast() {
  const t = ui.get().toast;
  if (!t) return null;
  if (t.view)
    return (
      <div class="toast dlpop" key={t.id} onClick={() => (setUi({ toast: null }), nav('downloads'))}>
        <I n="download" /><span>{t.msg}</span><b>View</b>
      </div>
    );
  return <div class="toast" key={t.id}>{t.msg}</div>;
}

export function PinDialog() {
  const f = ui.get().pin;
  if (!f) return null;
  const press = (k: string) => {
    if (k === 'cancel') {
      setUi({ pin: null });
      if (f.mode === 'enter') {
        setUi({ adultOk: false });
        router.root('home');
      }
      return;
    }
    const shown = k !== 'back' && f.buf.length === 3 ? { ...f, buf: f.buf + k } : null;
    if (shown) {
      setUi({ pin: shown }); // show the 4th dot, then check (prototype waits 140 ms)
      setTimeout(() => finish(pinPress(f, k, adult)), 140);
      return;
    }
    finish(pinPress(f, k, adult));
  };
  const finish = (r: ReturnType<typeof pinPress>) => {
    setUi({ pin: r.flow });
    if (r.outcome === 'unlocked') setUi({ adultOk: true });
    if (r.outcome === 'enabled') toast('Adult section enabled');
    if (r.outcome === 'disabled') (setUi({ adultOk: false }), toast('Adult section turned off'));
    if (r.outcome === 'changed') toast('PIN changed');
  };
  return (
    <>
      <div class="scrim" style="z-index:70" />
      <div class="dialog pinbox" style="z-index:71">
        <div class="pt"><I n="shield-lock-outline" /></div>
        <h4 style="text-align:center;font-size:20px;margin:6px 0 2px">{pinTitle(f)}</h4>
        <div class="pdots">{[0, 1, 2, 3].map((i) => <i key={i} class={i < f.buf.length ? 'on' : ''} />)}</div>
        <div class="pkp">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'x', '0', 'b'].map((k) =>
            k === 'x' ? <span key={k} class="pk g" onClick={() => press('cancel')}>Cancel</span>
            : k === 'b' ? <span key={k} class="pk g" onClick={() => press('back')}><I n="backspace-outline" /></span>
            : <span key={k} class="pk" onClick={() => press(k)}>{k}</span>,
          )}
        </div>
      </div>
    </>
  );
}

/** Prototype `playSplash`: C-mark draws, play pops, letters fade in, ~2.6 s then fade out. */
export function Splash() {
  const [st, setSt] = useState<'in' | 'out' | 'gone'>('in');
  useEffect(() => {
    const a = setTimeout(() => setSt('out'), 2600);
    const b = setTimeout(() => setSt('gone'), 3200);
    return () => (clearTimeout(a), clearTimeout(b));
  }, []);
  if (st === 'gone') return null;
  return (
    <div id="splash" class={st === 'out' ? 'out' : ''}>
      <div class="sglow" />
      <svg class="smark" viewBox="0 0 24 24"><path class="sc" d="M17.3 7.7a6.9 6.9 0 1 0 0 8.6" pathLength={1} /><path class="sp" d="M11.4 9.6l4.2 2.4-4.2 2.4z" /></svg>
      <div class="sword">{'CINETOR'.split('').map((c, i) => <span key={i} style={`animation-delay:${0.9 + i * 0.07}s`}>{c}</span>)}</div>
      <div class="stag">Watch · Read · Listen</div>
      <div class="sbar"><i /></div>
      <div class="sby">Developed by Mythbrix</div>
    </div>
  );
}
