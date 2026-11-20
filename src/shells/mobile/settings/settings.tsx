// Settings (prototype V.settings, V.appearance, V.playerset, V.substyle, V.prefs, V.data, V.adultset, V.about).
import { VERSION, DEVELOPER } from '../../../core/config';
import { startPin } from '../../../core/pin';
import { clearTmdbCache } from '../../../core/tmdb';
import { SEEDS } from '../../shared/theme';
import { I } from '../ui/icons';
import { MenuTop, Sect, Slider, SRow, SubPage, Sw, SwRow } from '../ui/common';
import { adult, library, nav, on, setUi, theme, toast, toggle, ui } from '../state';
import { SubStyleBody } from '../player/subs';
import { checkNow } from '../updates';

export function Settings() {
  return (
    <>
      <MenuTop t="Settings" noSearch />
      <div class="scroll">
        <Sect t="Library & Downloads">
          <SRow ic="bookmark-multiple-outline" t="My Library" d="Titles you saved" onClick={() => nav('library')} />
          <SRow ic="download-circle-outline" t="Downloads" d="Downloaded titles, queue and save location" onClick={() => nav('downloads')} />
        </Sect>
        <Sect t="Parental control">
          <SRow ic="shield-lock-outline" t="Adult section" d={adult.isOn() ? 'On · PIN required to open' : 'Off · hidden until you set a PIN'} onClick={() => nav('adultset')} />
        </Sect>
        <Sect t="Options">
          <SRow ic="palette-outline" t="Appearance" onClick={() => nav('appearance')} />
          <SRow ic="play-circle-outline" t="Player settings" onClick={() => nav('playerset')} />
          <SRow ic="tune-variant" t="Preferences" onClick={() => nav('prefs')} />
          <SRow ic="shield-lock-outline" t="Network" d="WARP, AntiDPI and DNS over HTTPS" onClick={() => nav('network')} />
        </Sect>
        <Sect t="Data Management">
          <SRow ic="database-outline" t="Data management" d="Backups, cache, watch progress, and sync" onClick={() => nav('data')} />
        </Sect>
        <Sect t="About">
          <SRow ic="information-outline" t="About Cinetor" onClick={() => nav('about')} />
        </Sect>
      </div>
    </>
  );
}
Settings.tab = 'settings';

export function Appearance() {
  const seed = theme.get().seed;
  return (
    <SubPage t="Appearance" s="Theme, accent color and icon">
      <div class="pad">
        <SRow t="Liquid glass" d="Translucent glass surfaces. Off = default flat theme" tail={<Sw k="lg" />} onClick={() => toggle('lg')} style="padding:10px 0" />
        <SRow t="Wallpaper colors" d="Match the system Material You palette" tail={<Sw k="wall" />} onClick={() => toggle('wall')} style="padding:10px 0" />
        <div class="title-m" style="margin-top:10px">Accent color</div>
        <div class="body-s">Choose a curated seed for Cinetor's dark palette</div>
        <div class="swatches">{SEEDS.map(([n, c]) => <i key={c} title={n} class={c === seed ? 'on' : ''} style={`background:${c};cursor:pointer`} onClick={() => theme.set({ seed: c })}>{c === seed && <I n="check" />}</i>)}</div>
        <div class="title-m" style="margin-top:10px">Launcher icon</div>
        <div class="body-s">Choose the icon color shown on your home screen</div>
        <div class="swatches">{SEEDS.map(([n, c]) => <i key={c} class={c === seed ? 'on' : ''} style={`background:${c};border-radius:14px;cursor:pointer`} onClick={() => toast('Launcher icon: ' + n)} />)}</div>
        <SRow t="Dynamic info accent" d="Match the info page accent to each title artwork" tail={<Sw k="dyn" />} onClick={() => toggle('dyn')} style="padding:14px 0" />
      </div>
    </SubPage>
  );
}

export function PlayerSettings() {
  return (
    <SubPage t="Player settings" s="Playback, controls, appearance, and subtitles">
      <Sect t="Customize player">
        <SRow ic="view-dashboard-outline" t="Control layout" d="Arrange, move, and hide controls" onClick={() => toast('Control layout editor')} />
        <SRow ic="subtitles-outline" t="Subtitle style" d="Font, colors, background, placement, and more" onClick={() => nav('substyle')} />
      </Sect>
      <Sect t="Opening videos">
        <SwRow k="ov" t="Open videos from other apps" d="Show Cinetor in Open with and video sharing options" />
        <SwRow k="lf" t="Ask for local file first" d="Offer to play a video file from this device first" />
        <SwRow k="ac" t="External player" d="Open videos in another player app" />
      </Sect>
      <Sect t="Playback">
        <Slider t="Playback speed" v="1.0×" pct={33} />
        <SwRow k="amb" t="Ambient lighting" d="Soft video colors in the black bars around the picture" />
        <Slider t="Ambient intensity" v="60%" pct={60} />
        <SwRow k="nm" t="Notification media controls" />
        <SwRow k="hs" t="Hide seek buttons" />
      </Sect>
    </SubPage>
  );
}

export const SubStylePage = () => <SubPage t="Subtitle style" s="Size, color, stroke and placement"><div class="pad"><SubStyleBody /></div></SubPage>;

export function Prefs() {
  return (
    <SubPage t="Preferences" s="Manage app behavior, privacy, and downloads">
      <Sect t="Experience">
        <SwRow k="hap" t="Haptic feedback" d="Use subtle vibration for actions and selections" />
        <SwRow k="tbl" t="Tab bar labels" d="Show destination names below navigation icons" />
        <SwRow k="cw" t="Continue watching" d="Show the Continue watching row on Home." />
        <SwRow k="ed" t="External downloader" d="Send every download to another app" />
        <SwRow k="sw2" t="Skip in-app webview" d="Open web links in your default browser" />
      </Sect>
      <Sect t="Privacy">
        <SwRow k="crash" t="Usage and crash reports" d="Help improve Cinetor with anonymous diagnostics" />
      </Sect>
    </SubPage>
  );
}

function Dialog({ t, p, ok, act }: { t: string; p: string; ok: string; act: () => void }) {
  return (
    <>
      <div class="scrim" onClick={() => setUi({ dialog: null })} />
      <div class="dialog"><h4>{t}</h4><p>{p}</p><div class="acts"><span class="btn text" onClick={() => setUi({ dialog: null })}>Cancel</span><span class="btn text" onClick={() => (setUi({ dialog: null }), act())}>{ok}</span></div></div>
    </>
  );
}

function download(name: string, text: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name;
  a.click();
}

export function DataMgmt() {
  const dlg = ui.get().dialog;
  const exportBackup = () => {
    const data: Record<string, string | null> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (k.startsWith('cinetor:') && !k.startsWith('cinetor:tmdb:')) data[k] = localStorage.getItem(k);
    }
    download('cinetor-backup.json', JSON.stringify(data));
    toast('Backup saved');
  };
  const restore = () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'application/json';
    inp.onchange = async () => {
      try {
        const data = JSON.parse(await inp.files![0].text()) as Record<string, string>;
        Object.entries(data).forEach(([k, v]) => k.startsWith('cinetor:') && localStorage.setItem(k, v));
        location.reload();
      } catch {
        toast('Not a Cinetor backup');
      }
    };
    inp.click();
  };
  return (
    <>
      <SubPage t="Data management" s="Backups, cache, watch progress, and sync">
        <Sect t="Sync"><SwRow k="sync" t="Sync" d="Sync watch history, watchlist, and downloads across devices" ic="sync" /></Sect>
        <Sect t="Watch Progress"><SRow ic="history" t="Clear watch progress" d="Reset playback progress for all episodes and videos" onClick={() => setUi({ dialog: 'clearwp' })} /></Sect>
        <Sect t="Backup & Cache">
          <SRow ic="broom" t="Clear Cache" d="Clear temporary cache and images" onClick={() => (clearTmdbCache(), toast('App cache cleared'))} />
          <SRow ic="content-save-outline" t="Export backup" onClick={exportBackup} />
          <SRow ic="backup-restore" t="Restore backup" onClick={restore} />
          <SRow ic="delete-forever-outline" t="Erase everything" onClick={() => setUi({ dialog: 'erase' })} />
        </Sect>
      </SubPage>
      {dlg === 'clearwp' && <Dialog t="Clear watch progress?" p="This clears saved episode and video playback positions on this device." ok="Clear" act={() => (library.clearProgress(), toast('Watch progress cleared'))} />}
      {dlg === 'erase' && <Dialog t="Erase everything?" p="This permanently erases settings, Library and downloads info. It cannot be undone." ok="Erase everything" act={() => { Object.keys(localStorage).filter((k) => k.startsWith('cinetor:')).forEach((k) => localStorage.removeItem(k)); location.reload(); }} />}
    </>
  );
}

export function AdultSet() {
  const onn = adult.isOn();
  return (
    <SubPage t="Adult section" s="Parental control">
      <Sect t="Access">
        <SRow ic="shield-lock-outline" t="Enable Adult section" d={onn ? 'A PIN is needed every time you open it' : 'Create a PIN to turn it on'} tail={<div class={'sw' + (onn ? ' on' : '')} style="pointer-events:none" />} onClick={() => setUi({ pin: startPin(onn ? 'off' : 'set') })} />
      </Sect>
      {onn && <Sect t="PIN"><SRow ic="key-variant" t="Change PIN" d="Verify the current PIN first" onClick={() => setUi({ pin: startPin('chk') })} /></Sect>}
      <div class="body-s" style="padding:6px 20px">The Adult section is off until you enable it here. Once enabled, every entry asks for the PIN.</div>
    </SubPage>
  );
}

export function About() {
  return (
    <SubPage t="About Cinetor" s="App information and updates">
      <Sect t="App">
        <SRow ic="tag-outline" t="Version" d={'Cinetor ' + VERSION} tail={<span class="btn tonal" style="height:36px;padding:0 14px" onClick={(e) => (e.stopPropagation(), checkNow())}>Check</span>} />
        <SwRow k="aiu" t="Auto install updates" d="Download and install new releases automatically" />
        <SwRow k="cos" t="Check on startup" d="Look for a new release when Cinetor opens" />
      </Sect>
      <Sect t="Developer"><SRow ic="code-tags" t={DEVELOPER} tail={<span />} /></Sect>
      <Sect t="Logs">
        <SRow ic="file-export-outline" t="Export logs" onClick={() => toast('Logs exported')} />
        <SRow ic="file-remove-outline" t="Clear logs" onClick={() => toast('Logs cleared')} />
      </Sect>
    </SubPage>
  );
}
void on;
