// Hash routes: #q= quiz · #s= sweep · #join= link a device · #r= fallback result · empty = owner home.
// Owner screens use a simple view stack on top of home.
import { parseHash } from "./share/links.js";

export function currentRoute(loc = location) {
  const r = parseHash(loc.hash);
  const params = new URLSearchParams(loc.search);
  return { ...r, mode: params.get("store") === "local" ? "local" : undefined };
}

/** Remove the hash without reloading (so a refresh doesn't re-import). */
export function clearHash() {
  history.replaceState(null, "", location.pathname + location.search);
}

/**
 * Browser-history layer: each push() adds one history entry with a closer. The phone's back gesture
 * (popstate) runs the top closer, exactly like the in-app back button, which calls back() = history.back().
 * A closer may return "stay" to keep its entry (it only closed an overlay). Without a window (unit tests)
 * everything runs directly.
 */
export class BackLayer {
  constructor(win = globalThis) {
    this.win = win?.history && win.addEventListener ? win : null;
    this.closers = [];
    this.stale = 0; // entries whose screens are gone: skipped on the way back
    this.n = 0;
    this.win?.addEventListener("popstate", () => this._pop());
  }
  get depth() {
    return this.closers.length;
  }
  push(fn) {
    this.closers.push(fn);
    this.win?.history.pushState({ vs: ++this.n }, "");
  }
  /** The top entry now means something else (same history entry, new closer). */
  replaceTop(fn) {
    this.closers[this.closers.length - 1] = fn;
  }
  /** Go one step back: via history when there is an entry, else false (caller decides). */
  back() {
    if (!this.closers.length) return false;
    if (this.win) this.win.history.back();
    else this._pop();
    return true;
  }
  /** Screens were replaced wholesale: the entries stay in the browser but are skipped. */
  clear() {
    this.stale += this.closers.length;
    this.closers = [];
  }
  _pop() {
    const fn = this.closers.pop();
    if (!fn) {
      if (this.stale > 0) (this.stale--, this.win?.history.back());
      return;
    }
    this.n = Math.max(0, this.n - 1);
    if (fn() === "stay") this.push(fn);
  }
}

export class ViewStack {
  constructor(show, win = globalThis) {
    this.show = show; // (view) => void
    this.stack = [];
    this.layer = new BackLayer(win);
  }
  push(view) {
    this.stack.push(view);
    this.layer.push(() => this._pop());
    this.show(view);
  }
  _pop() {
    if (this.stack.length > 1) this.stack.pop();
    this.show(this.stack.at(-1));
  }
  /** In-app back button: same path as the back gesture. */
  back() {
    if (!this.layer.back()) this._pop();
  }
  reset(view) {
    this.stack = [view];
    this.layer.clear();
    this.show(view);
  }
  get top() {
    return this.stack.at(-1);
  }
}
