// Adult section PIN: hash compatible with the prototype `pinHash`, plus the keypad flow (`pinDone`).
import { createStore, type Store } from './store';

export const pinHash = (x: string): string => [...x].reduce((a, c) => ((a * 131 + c.charCodeAt(0)) >>> 0), 17) + '';

interface AdultState { on: boolean; pin: string }

export function createAdult(store: Store<AdultState> = createStore<AdultState>('adult', { on: false, pin: '' }, true)) {
  return {
    store,
    isOn: () => store.get().on,
    enableAdult(pin: string) {
      store.set({ on: true, pin: pinHash(pin) });
    },
    verify: (pin: string) => store.get().on && store.get().pin === pinHash(pin),
    disableAdult(pin: string): boolean {
      if (store.get().pin !== pinHash(pin)) return false;
      store.set({ on: false, pin: '' });
      return true;
    },
    changePin(oldPin: string, newPin: string): boolean {
      if (store.get().pin !== pinHash(oldPin)) return false;
      store.set({ pin: pinHash(newPin) });
      return true;
    },
  };
}
export type Adult = ReturnType<typeof createAdult>;

// ---- keypad flow -------------------------------------------------------------
export type PinMode = 'enter' | 'set' | 'off' | 'chk';
export type PinStep = 'enter' | 'set' | 'set2' | 'off' | 'chk';
export interface PinFlow { mode: PinMode; step: PinStep; buf: string; tmp?: string; msg?: string }
export type PinOutcome = 'none' | 'unlocked' | 'enabled' | 'disabled' | 'changed' | 'cancel';

export const PINT: Record<PinStep | 'bad', string> = {
  enter: 'Enter PIN', set: 'Create a 4-digit PIN', set2: 'Confirm your PIN', off: 'Enter PIN to turn off', chk: 'Enter current PIN', bad: 'Wrong PIN, try again',
};
export const pinTitle = (f: PinFlow) => f.msg || PINT[f.step];
export const startPin = (mode: PinMode): PinFlow => ({ mode, step: mode, buf: '' });

/** Apply one key ('0'-'9', 'back', 'cancel'). After the 4th digit the PIN is checked. */
export function pinPress(f: PinFlow, key: string, adult: Adult): { flow: PinFlow | null; outcome: PinOutcome } {
  if (key === 'cancel') return { flow: null, outcome: 'cancel' };
  if (key === 'back') return { flow: { ...f, buf: f.buf.slice(0, -1) }, outcome: 'none' };
  if (!/^\d$/.test(key) || f.buf.length >= 4) return { flow: f, outcome: 'none' };
  const buf = f.buf + key;
  if (buf.length < 4) return { flow: { ...f, buf, msg: undefined }, outcome: 'none' };
  const v = buf;
  const base = { ...f, buf: '', msg: undefined };
  if (f.step === 'enter' || f.step === 'off' || f.step === 'chk') {
    if (adult.store.get().pin !== pinHash(v)) return { flow: { ...base, msg: PINT.bad }, outcome: 'none' };
    if (f.step === 'enter') return { flow: null, outcome: 'unlocked' };
    if (f.step === 'off') {
      adult.disableAdult(v);
      return { flow: null, outcome: 'disabled' };
    }
    return { flow: { ...base, step: 'set', tmp: undefined }, outcome: 'none' }; // chk → set new PIN
  }
  if (f.step === 'set') return { flow: { ...base, step: 'set2', tmp: v }, outcome: 'none' };
  if (v !== f.tmp) return { flow: { ...base, step: 'set', tmp: undefined, msg: 'PINs did not match' }, outcome: 'none' };
  if (f.mode === 'chk') {
    adult.store.set({ pin: pinHash(v) });
    return { flow: null, outcome: 'changed' };
  }
  adult.enableAdult(v);
  return { flow: null, outcome: 'enabled' };
}
