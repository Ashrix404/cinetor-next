import { useEffect, useState } from 'preact/hooks';
import type { Store } from '../../../core/store';

/** Re-render when the store changes. */
export function useStore<T extends object>(s: Store<T>): T {
  const [, set] = useState(0);
  useEffect(() => s.subscribe(() => set((n) => n + 1)), [s]);
  return s.get();
}

/** Load async data; re-runs when `key` changes. */
export function useAsync<T>(fn: () => Promise<T>, key: string): { data: T | null; error: unknown; loading: boolean; retry: () => void } {
  const [st, setSt] = useState<{ data: T | null; error: unknown; loading: boolean }>({ data: null, error: null, loading: true });
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    setSt((s) => ({ data: s.data, error: null, loading: true }));
    fn().then(
      (data) => alive && setSt({ data, error: null, loading: false }),
      (error) => alive && setSt((s) => ({ data: s.data, error, loading: false })),
    );
    return () => {
      alive = false;
    };
  }, [key, n]);
  return { ...st, retry: () => setN((x) => x + 1) };
}
