// "The server is busy today" (free-tier limits): Firestore resource-exhausted, the relay's 402/429, ntfy's 429. Lazy: loaded only when a limit is hit.
import { PLAY } from "./data/strings-play.js";
import { toast } from "./ui/dom.js";

export const isBusy = (x) => x?.code === "resource-exhausted" || x === 402 || x === 429;
let last = 0;

/** One calm toast, at most once a minute. */
export function tellBusy(show = toast, now = Date.now()) {
  if (now - last < 60000) return false;
  last = now;
  show(PLAY.busy);
  return true;
}

/** Retry a failed write while the failure is a busy one: waits 2 s then 6 s, three tries in all, then the error goes on (no loop). */
export async function retryBusy(fn, first, waits = [2000, 6000], sleep = (ms) => new Promise((r) => setTimeout(r, ms))) {
  let err = first;
  for (const w of waits) {
    await sleep(w);
    try {
      return await fn();
    } catch (e) {
      if (!isBusy(e)) throw e;
      err = e;
    }
  }
  throw err;
}
