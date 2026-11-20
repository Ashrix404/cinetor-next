// Settings › Network (vega-app parity): WARP mode, AntiDPI mode (+ presets / command line args), DNS over HTTPS.
import { useEffect, useState } from 'preact/hooks';
import { BYEDPI_PRESETS, DEFAULT_BYEDPI_ARGS, DOH_PROVIDERS, dohHint, netGet, netSet, netSupported, validDohUrl, WEB_NOTE, type NetState } from '../../../core/net';
import { I } from '../ui/icons';
import { SubPage } from '../ui/common';
import { toast } from '../state';

export function Network() {
  const ok = netSupported();
  const [s, setS] = useState<NetState | null>(null);
  const [busy, setBusy] = useState('');
  const [open, setOpen] = useState(false);
  const [args, setArgs] = useState('');
  const [url, setUrl] = useState('');
  useEffect(() => void netGet().then((v) => (setS(v), setArgs(v.antiDpiArgs), setUrl(v.dohUrl))), []);
  const apply = async (p: Parameters<typeof netSet>[0], what: string) => {
    setBusy(what);
    if (p.warp) toast('Connecting to Cloudflare WARP...');
    try {
      const r = await netSet(p);
      setS(r);
      if (r.error) toast(r.error);
      else if (p.warp) toast('WARP connected');
      else if (p.antiDpi) toast('AntiDPI on');
    } catch (e) {
      toast(String((e as Error).message || e));
    }
    setBusy('');
  };
  if (!s) return <SubPage t="Network" s="WARP, AntiDPI and DNS over HTTPS"><div class="body-m pad">Loading…</div></SubPage>;
  const sw = (on: boolean) => <div class={'sw' + (on ? ' on' : '')} style="pointer-events:none" />;
  return (
    <SubPage t="Network" s="WARP, AntiDPI and DNS over HTTPS">
      {!ok && <div class="netnote">{WEB_NOTE}</div>}
      <div class={'card' + (ok ? '' : ' dis')} style="margin-top:12px">
        <div class="netrow" onClick={() => !busy && apply({ warp: !s.warp }, 'warp')}>
          <div class="ico"><I n="shield-lock-outline" /></div>
          <div class="tx"><b>WARP Mode{s.warpRunning && <span class="netbadge">ON</span>}</b><small>{busy === 'warp' ? 'Connecting to Cloudflare WARP...' : 'Bypass ISP restrictions with Cloudflare WARP VPN'}</small></div>
          {sw(s.warp)}
        </div>
        <div class="netrow" onClick={() => !busy && apply({ antiDpi: !s.antiDpi }, 'dpi')}>
          <div class="ico"><I n="tune-variant" /></div>
          <div class="tx"><b>AntiDPI Mode{s.antiDpiRunning && <span class="netbadge">ON</span>}</b><small>{busy === 'dpi' ? 'Starting…' : 'Bypass ISP blocking without VPN'}</small></div>
          {sw(s.antiDpi)}
        </div>
        <div class="netbox">
          <span class="btn text" style="height:34px;padding:0" onClick={() => setOpen(!open)}>{open ? 'Hide parameters' : 'Configure parameters'}</span>
          {open && (
            <>
              {BYEDPI_PRESETS.map((p) => (
                <span key={p.id} class={'preset' + (args.trim() === p.args ? ' on' : '')} onClick={() => setArgs(p.args)}>{p.name}<small>{p.description}</small></span>
              ))}
              <div style="display:flex;justify-content:space-between;align-items:center;margin:10px 0 6px"><b style="font-size:13px">Command Line Arguments</b><span style="color:var(--primary);font-size:12px" onClick={() => setArgs(DEFAULT_BYEDPI_ARGS)}>Reset default</span></div>
              <textarea rows={2} value={args} placeholder={DEFAULT_BYEDPI_ARGS} onInput={(e) => setArgs((e.target as HTMLTextAreaElement).value)} />
              <span class="btn" style="height:38px;margin-top:10px" onClick={() => apply({ antiDpiArgs: args }, 'dpi')}>Apply</span>
            </>
          )}
        </div>
      </div>
      <div class="sec" style="margin-top:14px">DNS over HTTPS</div>
      <div class={'card' + (ok ? '' : ' dis') + (s.warp ? ' dis' : '')} style="margin-top:8px;padding-top:10px">
        <div class="body-s" style="padding:0 16px 10px">{dohHint(s)}</div>
        <div class="netsel">{DOH_PROVIDERS.map((p) => <span key={p.value} class={s.doh === p.value ? 'on' : ''} onClick={() => (p.value === 'custom' && !validDohUrl(url) ? setS({ ...s, doh: 'custom' }) : apply({ doh: p.value }, 'doh'))}>{p.label}</span>)}</div>
        {s.doh === 'custom' && (
          <div class="netbox">
            <b style="font-size:13px;display:block;margin-bottom:6px">Custom DoH URL</b>
            <input value={url} placeholder="https://dns.example.com/dns-query" autocomplete="off" onInput={(e) => setUrl((e.target as HTMLInputElement).value)} />
            <span class="btn" style="height:38px;margin-top:10px" onClick={() => (validDohUrl(url) ? apply({ doh: 'custom', dohUrl: url }, 'doh') : toast('Enter an https:// DoH URL'))}>Save</span>
          </div>
        )}
      </div>
      {s.error && <div class="netnote">{s.error}</div>}
      <div class="gap" />
    </SubPage>
  );
}
