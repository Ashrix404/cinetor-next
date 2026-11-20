import { useEffect, useRef } from 'preact/hooks';
import { useStore } from '../ui/hooks';
import { embedLoaded, getVideo, pl } from './store';
import { sandboxFor } from '../../../core/embeds';
import { isNative } from '../../../core/platform';

/**
 * Mounts the shared native <video> element inside this box (prototype `.vid`).
 * Keeps playback native-first with zero third-party iframe chrome.
 */
export function VideoHost({ fit, hue }: { fit: string; hue: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const s = useStore(pl);

  useEffect(() => {
    const v = getVideo();
    const was = s.st.playing;
    if (ref.current && !ref.current.contains(v)) {
      ref.current.appendChild(v);
    }
    // Moving a <video> to another parent makes the browser pause it (portrait → landscape stop bug).
    if (was && v.paused) void v.play().catch(() => {});
  }, [s.st.mode, s.pip]);

  return (
    <div ref={ref} class={'vid fit-' + fit} style={`--h:${hue};`}>
      {/* Offscreen headless embed bridge: zero iframe chrome, kept for fallback stream probe / guard */}
      {s.embedUrl && (
        <iframe
          key={s.embedUrl}
          src={s.embedUrl}
          style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;border:none;clip:rect(0,0,0,0);overflow:hidden;z-index:-1;"
          tabIndex={-1}
          aria-hidden="true"
          sandbox={sandboxFor(s.embedUrl, isNative())}
          onLoad={embedLoaded}
        />
      )}
      {/* Native player loading overlay */}
      {s.loading && (
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(5,6,10,0.85);z-index:3;gap:12px;pointer-events:none;">
          <div style="width:48px;height:48px;border:3.5px solid rgba(255,255,255,0.15);border-top-color:#38bdf8;border-right-color:#38bdf8;border-radius:50%;animation:spin 0.8s linear infinite;box-shadow:0 0 20px rgba(56,189,248,0.35);" />
          <span style="font-size:13px;color:rgba(255,255,255,0.8);font-weight:500;letter-spacing:0.3px;">Loading stream…</span>
        </div>
      )}
    </div>
  );
}
