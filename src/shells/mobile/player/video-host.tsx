import { useEffect, useRef, useState } from 'preact/hooks';
import { useStore } from '../ui/hooks';
import { getVideo, pl } from './store';

/** Mounts the shared <video> element or web stream iframe inside this box (prototype `.vid`). */
export function VideoHost({ fit, hue }: { fit: string; hue: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const s = useStore(pl);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  useEffect(() => {
    if (s.embedUrl) return;
    const v = getVideo();
    const was = s.st.playing;
    ref.current?.appendChild(v);
    // Moving a <video> to another parent makes the browser pause it (portrait → landscape stop bug).
    if (was && v.paused) void v.play().catch(() => {});
  }, [s.embedUrl]);

  useEffect(() => {
    setIframeLoaded(false);
  }, [s.embedUrl]);

  if (s.embedUrl) {
    return (
      <div class={'vid fit-' + fit} style={`--h:${hue};position:relative;background:#05060a;overflow:hidden;`}>
        <iframe
          src={s.embedUrl}
          style="width:100%;height:100%;border:none;position:absolute;inset:0;"
          allowFullScreen
          allow="autoplay *; encrypted-media *; fullscreen *; picture-in-picture *"
          onLoad={() => setIframeLoaded(true)}
        />
        {(!iframeLoaded || s.loading) && (
          <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#05060a;z-index:3;gap:12px;pointer-events:none;">
            <div style="width:48px;height:48px;border:3.5px solid rgba(255,255,255,0.15);border-top-color:#38bdf8;border-right-color:#38bdf8;border-radius:50%;animation:spin 0.8s linear infinite;box-shadow:0 0 20px rgba(56,189,248,0.35);" />
            <span style="font-size:13px;color:rgba(255,255,255,0.8);font-weight:500;letter-spacing:0.3px;">Loading stream…</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={ref} class={'vid fit-' + fit} style={`--h:${hue};position:relative;`}>
      {s.loading && (
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(5,6,10,0.85);z-index:3;gap:12px;pointer-events:none;">
          <div style="width:48px;height:48px;border:3.5px solid rgba(255,255,255,0.15);border-top-color:#38bdf8;border-right-color:#38bdf8;border-radius:50%;animation:spin 0.8s linear infinite;box-shadow:0 0 20px rgba(56,189,248,0.35);" />
          <span style="font-size:13px;color:rgba(255,255,255,0.8);font-weight:500;letter-spacing:0.3px;">Loading stream…</span>
        </div>
      )}
    </div>
  );
}
