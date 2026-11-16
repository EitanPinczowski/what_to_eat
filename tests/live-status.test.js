// Item 8: fresh status with relative times; item 7: delivery receipt line.
import { test } from "node:test";
import assert from "node:assert/strict";
import { relTime, liveLine, freshLive } from "../js/ui/owner/live-status.js";
import { MemoryStore } from "../js/store/memory.js";

const NOW = new Date(2026, 10, 16, 15, 0, 0).getTime();
const ago = (ms) => new Date(NOW - ms).toISOString();
const MIN = 60e3;
const H = 3600e3;

test("relTime: now, minutes, hours, yesterday, days; junk gives empty", () => {
  assert.equal(relTime(ago(20e3), NOW), "הרגע");
  assert.equal(relTime(ago(MIN), NOW), "לפני דקה");
  assert.equal(relTime(ago(3 * MIN + 5e3), NOW), "לפני 3 דק׳");
  assert.equal(relTime(ago(59 * MIN), NOW), "לפני 59 דק׳");
  assert.equal(relTime(ago(H), NOW), "לפני שעה");
  assert.equal(relTime(ago(2 * H), NOW), "לפני שעתיים");
  assert.equal(relTime(ago(5 * H), NOW), "לפני 5 שע׳");
  assert.equal(relTime(new Date(2026, 10, 15, 9, 0).toISOString(), NOW), "אתמול");
  assert.equal(relTime(new Date(2026, 10, 13, 20, 0).toISOString(), NOW), "לפני 3 ימים");
  assert.equal(relTime(ago(-5 * MIN), NOW), "הרגע");
  assert.equal(relTime("", NOW), "");
  assert.equal(relTime("not a date", NOW), "");
});

test("liveLine: sent, opened, step, finished all carry a time; the old texts remain without one", () => {
  assert.equal(liveLine(null, "נגה", NOW), "עוד לא נפתח");
  assert.equal(liveLine({ sentAt: ago(3 * MIN) }, "נגה", NOW), "נשלח לפני 3 דק׳");
  assert.equal(liveLine({ opened: ago(2 * MIN), n: 0 }, "נגה", NOW), "נגה פתחה לפני 2 דק׳");
  assert.equal(liveLine({ opened: ago(9 * MIN), n: 4, at: ago(MIN) }, "נגה", NOW), "נגה פתחה · שאלה 4 · לפני דקה");
  assert.equal(liveLine({ opened: ago(9 * MIN), n: 7, finished: true, at: ago(4 * MIN) }, "נגה", NOW), "נגה סיימה לפני 4 דק׳ 🎉");
  assert.equal(liveLine({ opened: "x", n: 0 }, "נגה", NOW), "נגה פתחה");
});

test("freshLive resets a finished or untouched run, keeps the dead list, leaves a quiz in progress alone", () => {
  const f = freshLive({ opened: ago(H), finished: true, at: ago(H), ack: "seen", resultId: "r", dead: ["ab"] }, NOW);
  assert.deepEqual(f, { sentAt: new Date(NOW).toISOString(), finished: false, dead: ["ab"] });
  assert.deepEqual(freshLive(null, NOW), { sentAt: new Date(NOW).toISOString(), finished: false });
  assert.equal(freshLive({ opened: ago(5 * MIN), n: 3, at: ago(MIN) }, NOW), null);
  assert.ok(freshLive({ opened: ago(3 * H), n: 3, at: ago(2 * H) }, NOW));
});

test("a new send clears her run in the store", async () => {
  const s = await new MemoryStore("freshroom000000000000000").ready();
  await s.put("live", "quiz", { opened: ago(H), finished: true, resultId: "r", at: ago(H), ack: "seen", push: { ok: true } });
  await s.put("live", "quiz", freshLive(s.doc("live", "quiz"), NOW));
  const d = s.doc("live", "quiz");
  assert.equal(d.finished, false);
  assert.equal(d.opened, undefined);
  assert.equal(d.ack, undefined);
  assert.equal(d.push, undefined);
  assert.ok(d.sentAt);
});
