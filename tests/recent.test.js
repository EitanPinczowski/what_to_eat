// Item 9: the picker from home links to her latest quiz result when it is fresh and unlinked.
import { test } from "node:test";
import assert from "node:assert/strict";
import { recentQuizEntry, RECENT_MS } from "../js/ui/owner/recent.js";

const now = Date.parse("2026-06-10T20:00:00Z");
const at = (ms) => new Date(now - ms).toISOString();

test("fresh unlinked result is picked, newest first", () => {
  const list = [{ id: "a", at: at(3600e3), f: "pizza" }, { id: "b", at: at(600e3), f: "sushi" }];
  assert.equal(recentQuizEntry(list, now).id, "b");
});

test("older than 3 hours, linked or going: today's behaviour (null)", () => {
  assert.equal(recentQuizEntry([{ id: "a", at: at(RECENT_MS), f: "pizza" }], now), null);
  assert.equal(recentQuizEntry([{ id: "a", at: at(1000), f: "pizza", place: "p1" }], now), null);
  assert.equal(recentQuizEntry([{ id: "a", at: at(1000), f: "pizza", goAt: at(500) }], now), null);
  assert.equal(recentQuizEntry([], now), null);
  assert.equal(recentQuizEntry(undefined, now), null);
});

test("a free-text result counts; a bad date or no food does not", () => {
  assert.equal(recentQuizEntry([{ id: "a", at: at(1000), fn: "משהו" }], now).id, "a");
  assert.equal(recentQuizEntry([{ id: "a", at: "nope", f: "pizza" }], now), null);
  assert.equal(recentQuizEntry([{ id: "a", at: at(1000) }], now), null);
});
