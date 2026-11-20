import { useEffect, useRef } from 'preact/hooks';
import { getVideo } from './store';

/** Mounts the shared <video> element inside this box (prototype `.vid`). */
export function VideoHost({ fit, hue }: { fit: string; hue: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const v = getVideo();
    ref.current?.appendChild(v);
  }, []);
  return <div ref={ref} class={'vid fit-' + fit} style={`--h:${hue}`} />;
}
