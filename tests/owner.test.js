import { test } from "node:test";
import assert from "node:assert/strict";
import { liveStatus } from "../js/ui/owner/app.js";

test("liveStatus reflects the guest's live doc", () => {
  assert.equal(liveStatus(null, "נגה"), "עוד לא נפתח");
  assert.equal(liveStatus({ opened: "x", n: 0 }, "נגה"), "נגה פתחה");
  assert.equal(liveStatus({ opened: "x", n: 5 }, "נגה"), "נגה פתחה · שאלה 5");
  assert.equal(liveStatus({ opened: "x", n: 9, finished: true }, "נגה"), "נגה סיימה! 🎉");
});

import { ackCard } from "../js/ui/owner/app.js";
import { MemoryStore } from "../js/store/memory.js";
import { STR } from "../js/data/strings.js";

test("ackCard shows the four replies only once she has sent", () => {
  assert.equal(ackCard(null), "");
  assert.equal(ackCard({ opened: "x", finished: false }), "");
  const h = ackCard({ finished: true, ack: "onway" });
  for (const c of ["seen", "ordered", "onway", "there"]) assert.ok(h.includes(`data-arg="${c}"`));
  assert.ok(h.includes('data-arg="onway" aria-pressed="true"'));
  assert.ok(h.includes('data-arg="seen" aria-pressed="false"'));
});

test("setAck stores a fixed code on live/quiz, keeps the doc, rejects unknown codes, resets on a new quiz", async () => {
  const s = new MemoryStore("room-1234567890123456789");
  await s.ready();
  assert.equal(await s.setAck("seen"), false); // not finished yet
  await s.put("live", "quiz", { opened: "o", finished: true, resultId: "r1", at: "t" });
  assert.equal(await s.setAck("pizza!"), false);
  assert.equal(await s.setAck("ordered"), true);
  const d = s.doc("live", "quiz");
  assert.equal(d.ack, "ordered");
  assert.equal(d.resultId, "r1");
  assert.ok(STR.ack[d.ack].line);
  assert.equal(await s.setAck(null), true);
  assert.equal(s.doc("live", "quiz").ack, undefined);
});
