// Stack router shared by all shells.
export type Route = { name: string; params?: Record<string, unknown> };

export interface Router {
  stack(): Route[];
  push(r: Route): void;
  pop(): boolean;
  root(name: string): void;
  subscribe(fn: () => void): () => void;
}

export function createRouter(initial: string): Router {
  let stack: Route[] = [{ name: initial }];
  const subs = new Set<() => void>();
  const emit = () => subs.forEach((fn) => fn());
  return {
    stack: () => stack.slice(),
    push(r) {
      stack = [...stack, r];
      emit();
    },
    pop() {
      if (stack.length <= 1) return false;
      stack = stack.slice(0, -1);
      emit();
      return true;
    },
    root(name) {
      stack = [{ name }];
      emit();
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

/**
 * "Press back again to exit" helper: returns true when a second Back arrives within `windowMs`.
 */
export function createExitGuard(windowMs = 2000, now: () => number = Date.now) {
  let last = -Infinity;
  return function shouldExit(): boolean {
    const t = now();
    const exit = t - last < windowMs;
    last = exit ? -Infinity : t;
    return exit;
  };
}
