// Tiny observable store with optional localStorage persistence.
export interface Store<T> {
  get(): T;
  set(patch: Partial<T>): void;
  subscribe(fn: (s: T) => void): () => void;
}

const PREFIX = 'cinetor:';

function read<T extends object>(key: string, initial: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return initial;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) !== Array.isArray(initial)) return initial;
    return Array.isArray(initial) ? (parsed as T) : { ...initial, ...(parsed as Partial<T>) };
  } catch {
    return initial;
  }
}

export function createStore<T extends object>(key: string, initial: T, persist: boolean): Store<T> {
  let state: T = persist ? read(key, initial) : initial;
  const subs = new Set<(s: T) => void>();
  return {
    get: () => state,
    set(patch) {
      state = Array.isArray(state) ? (patch as T) : { ...state, ...patch };
      if (persist) {
        try {
          localStorage.setItem(PREFIX + key, JSON.stringify(state));
        } catch {
          /* storage full or blocked: keep in memory */
        }
      }
      subs.forEach((fn) => fn(state));
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}
