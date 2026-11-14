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

export class ViewStack {
  constructor(show) {
    this.show = show; // (view) => void
    this.stack = [];
  }
  push(view) {
    this.stack.push(view);
    this.show(view);
  }
  back() {
    if (this.stack.length > 1) this.stack.pop();
    this.show(this.stack.at(-1));
  }
  reset(view) {
    this.stack = [view];
    this.show(view);
  }
  get top() {
    return this.stack.at(-1);
  }
}
