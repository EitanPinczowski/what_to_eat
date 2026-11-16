// Item 11: trim the error / feedback logs, and the Settings problems card.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MemoryStore } from "../js/store/memory.js";
import { NO_DELETE, LOGS, LOG_KEEP } from "../js/store/store.js";
import { problemsCard } from "../js/ui/owner/settings.js";

const ROOM = "abcdefghij0123456789wxyz";
const at = (i) => new Date(Date.UTC(2026, 5, 1) + i * 1000).toISOString();

test("error and feedback logs are deletable (store and rules agree)", () => {
  assert.deepEqual(NO_DELETE, []);
  const rules = readFileSync("firestore.rules", "utf8");
  assert.match(rules, /allow delete: if signedIn\(\)\s*&& col in \['history', 'places', 'live', 'feedback', 'errors', 'shopping'\]/);
});

test("trimLogs keeps the newest 200 of each log and leaves the rest alone", async () => {
  const s = await new MemoryStore(ROOM).ready();
  for (let i = 0; i < 205; i++) await s.put("errors", `e${i}`, { at: at(i), msg: `m${i}` });
  for (let i = 0; i < 203; i++) await s.put("feedback", `f${i}`, { at: at(i), text: `t${i}` });
  await s.put("places", "p1", { name: "x" });
  assert.equal(await s.trimLogs(), 8);
  assert.equal(s.list("errors").length, LOG_KEEP);
  assert.equal(s.list("errors")[0].id, "e204");
  assert.ok(!s.doc("errors", "e4"));
  assert.ok(s.doc("errors", "e5"));
  assert.equal(s.list("feedback").length, LOG_KEEP);
  assert.equal(s.list("places").length, 1);
  assert.equal(await s.trimLogs(), 0);
});

test("clearLog empties one log only, and refuses other collections", async () => {
  const s = await new MemoryStore(ROOM).ready();
  await s.put("errors", "e1", { at: at(1), msg: "a" });
  await s.put("feedback", "f1", { at: at(1), text: "b" });
  assert.equal(await s.clearLog("errors"), 1);
  assert.equal(s.list("errors").length, 0);
  assert.equal(s.list("feedback").length, 1);
  await assert.rejects(s.clearLog("history"));
  assert.deepEqual(LOGS, ["errors", "feedback"]);
});

test("problems card: count, last 20 only, newest first, empty state", async () => {
  const s = await new MemoryStore(ROOM).ready();
  assert.match(problemsCard(s), /תקלות \(0\)/);
  for (let i = 0; i < 25; i++) await s.put("errors", `e${i}`, { at: at(i), msg: `boom${i}x`, screen: "quiz" });
  const h = problemsCard(s, Date.parse(at(30))).s ?? String(problemsCard(s));
  assert.match(h, /תקלות \(25\)/);
  assert.equal((h.match(/boom\d+x/g) ?? []).length, 20);
  assert.ok(h.indexOf("boom24x") < h.indexOf("boom23x"));
  assert.ok(!h.includes("boom4x"));
  assert.match(h, /data-testid="clear-errors"/);
});

test("problems card escapes log text", async () => {
  const s = await new MemoryStore(ROOM).ready();
  await s.put("errors", "e1", { at: at(1), msg: "<img src=x onerror=1>" });
  assert.ok(!String(problemsCard(s)).includes("<img"));
});
