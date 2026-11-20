// One title's embed players and the automatic failover between them, shared by the mobile, desktop
// and TV players (each only renders the state it is given; the user never picks a player). Rules:
// - a player whose host is unreachable (DNS / TLS / connection failure) is skipped at once;
// - a player whose page says it will not play here ('blocked' from the APK embed guard) is skipped at once;
// - the loader goes away on the first sign of life: the guard's 'ready'/'playing' (APK) or iframe `load`;
// - after `loadMs` with no sign of life: a reachable player is shown anyway (iframe `load` waits for
//   every ad script, so a working player is often still "loading"; switching away from it was the
//   old churn), an unreachable / unanswered one is replaced by the next untried player;
// - when every player was tried: an accurate error, never an endless spinner.
import { embedEvent, embedHealth, hostOf, nextUntried, reachable, type Embed } from './embeds';

export interface EmbedView {
  /** index of the player in use */
  alt: number;
  embedUrl: string | null;
  loading: boolean;
  err: string | null;
}
export const ERR_OFFLINE = "Couldn't start this title. Check your connection and tap Retry.";
export const ERR_NONE = "This title can't be played right now. Tap Retry.";

export interface EmbedSessionOpts {
  loadMs?: number;
  reach?: (url: string) => Promise<boolean>;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (t: unknown) => void;
}

export class EmbedSession {
  private tried = new Set<number>();
  private gen = 0;
  private timer: unknown;
  private cur = -1;
  private alive = false;
  private reached: boolean | null = null;
  private loadMs: number;
  private reach: (url: string) => Promise<boolean>;
  private setT: (fn: () => void, ms: number) => unknown;
  private clearT: (t: unknown) => void;

  constructor(readonly embeds: Embed[], private emit: (v: EmbedView) => void, o: EmbedSessionOpts = {}) {
    this.loadMs = o.loadMs ?? 15000;
    this.reach = o.reach || ((u) => reachable(u));
    this.setT = o.setTimer || ((fn, ms) => setTimeout(fn, ms));
    this.clearT = o.clearTimer || ((t) => clearTimeout(t as ReturnType<typeof setTimeout>));
  }

  get current() {
    return this.cur;
  }

  /** Show player `i`. `fresh` (a Retry): forget which players the failover already tried. */
  start(i: number, fresh = false) {
    if (fresh) this.tried = new Set();
    if (!this.embeds[i]) return this.end(ERR_NONE);
    this.tried.add(i);
    this.cur = i;
    this.alive = false;
    this.reached = null;
    this.clearT(this.timer);
    const gen = ++this.gen;
    const url = this.embeds[i].url;
    this.emit({ alt: i, embedUrl: url, loading: true, err: null });
    void this.reach(url).then((ok) => {
      if (gen !== this.gen) return;
      this.reached = ok;
      if (!ok) this.fail();
    });
    this.timer = this.setT(() => {
      if (gen !== this.gen || this.alive) return;
      if (this.reached) this.show();
      else this.fail();
    }, this.loadMs);
  }

  /** iframe `load` fired: the page answered. */
  loaded() {
    if (this.cur < 0) return;
    this.show();
  }

  /** window `message` from the embed guard inside the iframe. */
  message(data: unknown) {
    const e = embedEvent(data);
    if (!e || this.cur < 0) return;
    const host = hostOf(this.embeds[this.cur].url) || e.host;
    if (e.ev === 'blocked') {
      embedHealth.set(host, 'blocked');
      return this.fail();
    }
    if (e.ev === 'playing') embedHealth.set(host, 'playing');
    this.show();
  }

  /** The current player is no good: the next untried one, or the final error. */
  fail() {
    if (this.cur < 0) return;
    const n = nextUntried(this.embeds.length, this.cur, this.tried);
    if (n < 0) return this.end(ERR_OFFLINE);
    this.start(n);
  }

  stop() {
    this.gen++;
    this.cur = -1;
    this.clearT(this.timer);
  }

  private show() {
    if (this.alive) return;
    this.alive = true;
    this.clearT(this.timer);
    this.emit({ alt: this.cur, embedUrl: this.embeds[this.cur].url, loading: false, err: null });
  }

  private end(err: string) {
    const alt = Math.max(0, this.cur);
    this.stop();
    this.emit({ alt, embedUrl: null, loading: false, err });
  }
}
