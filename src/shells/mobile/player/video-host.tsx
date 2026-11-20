import { useEffect, useRef } from 'preact/hooks';
import { getVideo, pl } from './store';

/** Mounts the shared <video> element or web stream iframe inside this box (prototype `.vid`). */
export function VideoHost({ fit, hue }: { fit: string; hue: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const s = pl.get();

  useEffect(() => {
    if (s.embedUrl) return;
    const v = getVideo();
    const was = pl.get().st.playing;
    ref.current?.appendChild(v);
    // Moving a <video> to another parent makes the browser pause it (portrait → landscape stop bug).
    if (was && v.paused) void v.play().catch(() => {});
  }, [s.embedUrl]);

  if (s.embedUrl) {
    return (
      <div class={'vid fit-' + fit} style={`--h:${hue};position:relative;background:#000;overflow:hidden;`}>
        <iframe
          src={s.embedUrl}
          style="width:100%;height:100%;border:none;position:absolute;inset:0;"
          allowFullScreen
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        />
      </div>
    );
  }

  return (
    <div ref={ref} class={'vid fit-' + fit} style={`--h:${hue};position:relative;`}>
      {s.loading && (
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);z-index:2;">
          <div style="width:36px;height:36px;border:3px solid rgba(255,255,255,0.2);border-top-color:#fff;border-radius:50%;animation:spin 0.8s linear infinite;" />
        </div>
      )}
    </div>
  );
}
