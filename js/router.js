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
 * Browser-history layer: ONE per window (BackLayer.shared) with a stack of entries. Each push() adds one history
 * entry with a closer; the phone's back gesture (popstate) runs the top closer, exactly like the in-app back
 * button, which calls back() = history.back(). A closer may return "stay" to keep its entry (it only closed an
 * overlay). Screens that come and go (a quiz, a sweep) take a scope() so that leaving them drops only their own
 * entries and never adds another popstate listener. Without a window (unit tests) everything runs directly.
 */
const shared = new WeakMap();
const BACK_LOCK_MS = 500;

export class BackLayer {
  constructor(win = globalThis) {
    this.win = win?.history && win.addEventListener ? win : null;
    this.entries = [];
    this.base = this.win?.history.state?.vs ?? 0;
    this.busy = false;
    this.listener = (e) => this._pop(e);
    this.win?.addEventListener("popstate", this.listener);
  }
  /** The one layer of this window. */
  static shared(win = globalThis) {
    if (!win?.history || !win.addEventListener) return new BackLayer(null);
    if (!shared.has(win)) shared.set(win, new BackLayer(win));
    return shared.get(win);
  }
  /** A view of this layer that owns only the entries it pushes. */
  scope() {
    return new BackScope(this);
  }
  /** Push as the layer's own default scope (single-screen users). */
  push(fn) {
    this._push(fn, this);
  }
  replaceTop(fn) {
    const e = this._top(this);
    if (e) e.fn = fn;
  }
  /** Live (not stale) entries. */
  get depth() {
    return this.entries.filter((e) => !e.stale).length;
  }
  destroy() {
    this.win?.removeEventListener?.("popstate", this.listener);
  }
  _push(fn, owner) {
    const e = { fn, stale: false, owner };
    this.entries.push(e);
    this.win?.history.pushState({ vs: this.base + this.entries.length }, "");
    return e;
  }
  _top(owner) {
    for (let i = this.entries.length - 1; i >= 0; i--) if (!this.entries[i].stale && (!owner || this.entries[i].owner === owner)) return this.entries[i];
    return null;
  }
  /** Go one step back: via history when there is an entry, else false (caller decides). */
  back() {
    if (!this.depth) return false;
    if (!this.win) return (this._pop(), true);
    if (this.busy) return true;
    this.busy = true;
    const t = setTimeout(() => (this.busy = false), BACK_LOCK_MS);
    t.unref?.();
    this.win.history.back();
    return true;
  }
  /** Screens were replaced wholesale: the entries stay in the browser but are skipped. */
  clear() {
    for (const e of this.entries) e.stale = true;
  }
  _pop(ev) {
    this.busy = false;
    const cur = this.entries.length;
    if (!cur) return;
    const landed = ev && "state" in ev ? Math.max(0, (ev.state?.vs ?? 0) - this.base) : cur - 1;
    if (landed > cur - 1) {
      if (landed > cur) this.win?.history.go(cur - landed);
      return;
    }
    const popped = this.entries.splice(landed, cur - landed).reverse();
    const top = popped[0];
    if (top.stale) {
      if (this.win && landed > 0) this.win.history.back();
      return;
    }
    for (const e of popped) {
      if (e.stale) continue;
      if (e.fn() === "stay") (this.entries.push(e), this.win?.history.pushState({ vs: this.base + this.entries.length }, ""));
    }
  }
}

class BackScope {
  constructor(layer) {
    this.layer = layer;
  }
  get depth() {
    return this.layer.entries.filter((e) => !e.stale && e.owner === this).length;
  }
  push(fn) {
    this.layer._push(fn, this);
  }
  /** The top entry now means something else (same history entry, new closer). */
  replaceTop(fn) {
    const e = this.layer._top(this);
    if (e) e.fn = fn;
  }
  back() {
    return this.depth ? this.layer.back() : false;
  }
  /** Leaving the screen: its entries stay in the browser but are skipped on the way back. */
  clear() {
    for (const e of this.layer.entries) if (e.owner === this) e.stale = true;
  }
  destroy() {
    this.clear();
  }
}

export class ViewStack {
  constructor(show, win = globalThis) {
    this.show = show;
    this.stack = [];
    this.shared = BackLayer.shared(win);
    this.layer = this.shared.scope();
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
    this.shared.clear();
    this.show(view);
  }
  get top() {
    return this.stack.at(-1);
  }
}
