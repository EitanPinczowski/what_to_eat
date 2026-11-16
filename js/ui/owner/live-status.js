// Item 8: relative times and the live quiz line with a time. Pure, so it is unit tested.
import { STR } from "../../data/strings.js";

const T = STR.owner;
const MIN = 60e3;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
/** Mid-quiz window: a new send does not wipe her progress while she answered within this long. */
export const ACTIVE_MS = 30 * MIN;

const dayStart = (t) => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/** "הרגע" / "לפני 3 דק׳" / "לפני 2 שע׳" / "אתמול" / "לפני 4 ימים" for an ISO time; "" when it is missing or unreadable. */
export function relTime(iso, now = Date.now()) {
  const t = Date.parse(iso);
  if (!iso || Number.isNaN(t)) return "";
  const ms = Math.max(0, now - t);
  if (ms < MIN) return T.rel.now;
  if (ms < HOUR) return T.rel.min(Math.floor(ms / MIN));
  if (ms < DAY) return T.rel.hour(Math.floor(ms / HOUR));
  const days = Math.round((dayStart(now) - dayStart(t)) / DAY);
  return days <= 1 ? T.rel.yesterday : T.rel.days(days);
}

/** The status line for her live quiz doc, with how long ago (sent / opened / progress / finished). */
export function liveLine(live, her, now = Date.now()) {
  const S = T.status;
  if (!live?.opened) {
    const r = relTime(live?.sentAt, now);
    return r ? S.sent(r) : S.none;
  }
  if (live.finished) {
    const r = relTime(live.at, now);
    return r ? S.doneAgo(her, r) : S.done(her);
  }
  const r = relTime(live.n ? live.at : live.opened, now) || relTime(live.opened, now);
  if (!r) return live.n ? S.step(her, live.n) : S.opened(her);
  return live.n ? S.stepAgo(her, live.n, r) : S.openedAgo(her, r);
}

/**
 * The live/quiz doc to store when Eitan sends a new link, or null to leave it alone (she is mid-quiz right now).
 * Everything of the old run is cleared (finished, answers, ack); only the dead-subscription list is kept.
 */
export function freshLive(cur, now = Date.now()) {
  const at = cur?.at ? Date.parse(cur.at) : NaN;
  if (cur?.opened && !cur.finished && Number.isFinite(at) && now - at < ACTIVE_MS) return null;
  const iso = new Date(now).toISOString();
  return { sentAt: iso, finished: false, ...(Array.isArray(cur?.dead) && cur.dead.length ? { dead: cur.dead } : {}) };
}
