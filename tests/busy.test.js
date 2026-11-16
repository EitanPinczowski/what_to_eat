// Graceful degrade: the free-tier "busy" answer is recognised, retried a bounded number of times and told once, calmly.
import { test } from "node:test";
import assert from "node:assert/strict";
import { isBusy, tellBusy, retryBusy } from "../js/busy.js";
import { PLAY } from "../js/data/strings-play.js";

test("busy: Firestore resource-exhausted and the relay's 402/429 count, nothing else", () => {
  assert.ok(isBusy({ code: "resource-exhausted" }) && isBusy(429) && isBusy(402));
  for (const x of [{ code: "permission-denied" }, 401, 400, 410, 500, 0, null]) assert.equal(isBusy(x), false);
});

test("busy: one calm toast, at most once a minute", () => {
  const shown = [];
  assert.equal(tellBusy((m) => shown.push(m), 1_000_000), true);
  assert.equal(tellBusy((m) => shown.push(m), 1_030_000), false);
  assert.equal(tellBusy((m) => shown.push(m), 1_061_000), true);
  assert.deepEqual(shown, [PLAY.busy, PLAY.busy]);
  assert.match(PLAY.busy, /השרת עמוס היום/);
});

test("busy: retries twice with back-off, then stops (no loop)", async () => {
  const waits = [];
  const sleep = async (ms) => void waits.push(ms);
  let n = 0;
  const busy = Object.assign(new Error("quota"), { code: "resource-exhausted" });
  await assert.rejects(retryBusy(async () => (n++, Promise.reject(busy)), busy, [2000, 6000], sleep), busy);
  assert.equal(n, 2);
  assert.deepEqual(waits, [2000, 6000]);
  let k = 0;
  assert.equal(await retryBusy(async () => (++k < 2 ? Promise.reject(busy) : "ok"), busy, [1, 2], async () => {}), "ok");
  await assert.rejects(retryBusy(() => Promise.reject(new Error("other")), busy, [1, 2], async () => {}), /other/);
});

test("toast: the same message is not shown twice at once (one failed save, one toast)", async () => {
  const kids = [];
  globalThis.document = {
    querySelectorAll: () => kids,
    createElement: () => ({ setAttribute() {}, remove() {} }),
    body: { append: (t) => kids.push(t) },
  };
  const { toast } = await import("../js/ui/dom.js");
  toast("שמירה נכשלה");
  toast("שמירה נכשלה");
  toast("אחרת");
  assert.deepEqual(kids.map((t) => t.textContent), ["שמירה נכשלה", "אחרת"]);
  delete globalThis.document;
});
