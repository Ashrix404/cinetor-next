import { useEffect, useRef } from 'preact/hooks';
import { getVideo, pl } from './store';

/** Mounts the shared <video> element inside this box (prototype `.vid`). */
export function VideoHost({ fit, hue }: { fit: string; hue: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const v = getVideo();
    const was = pl.get().st.playing;
    ref.current?.appendChild(v);
    // Moving a <video> to another parent makes the browser pause it (portrait → landscape stop bug).
    if (was && v.paused) void v.play().catch(() => {});
  }, []);
  return <div ref={ref} class={'vid fit-' + fit} style={`--h:${hue}`} />;
}
