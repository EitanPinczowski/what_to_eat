import { test } from "node:test";
import assert from "node:assert/strict";
import { backupDue, BACKUP_EVERY } from "../js/ui/owner/settings.js";

test("backup reminder is due with no backup or after 30 days", () => {
  const now = Date.parse("2026-11-14T12:00:00Z");
  assert.equal(backupDue({}, now), true);
  assert.equal(backupDue({ lastBackup: new Date(now - 864e5).toISOString() }, now), false);
  assert.equal(backupDue({ lastBackup: new Date(now - BACKUP_EVERY).toISOString() }, now), true);
});

import { normBase } from "../js/ui/owner/settings.js";
test("normBase accepts what a phone keyboard produces", () => {
  const want = "https://eitanpinczowski.github.io/what_to_eat/";
  assert.equal(normBase("https://eitanpinczowski.github.io/what_to_eat/"), want);
  assert.equal(normBase("Https://EitanPinczowski.github.io/what_to_eat"), want);
  assert.equal(normBase("  ‎https://eitanpinczowski.github.io/what_to_eat/index.html#q=1 "), want);
  assert.equal(normBase("eitanpinczowski.github.io/what_to_eat"), want);
  assert.equal(normBase(""), "");
  assert.equal(normBase("not an address"), null);
  assert.equal(normBase("ftp://x.y/"), null);
});

import { adoptRoom, ROOM_KEY, PREV_ROOM_KEY } from "../js/store/open.js";
const mem = (o = {}) => ({ getItem: (k) => o[k] ?? null, setItem: (k, v) => void (o[k] = v), o });

test("join link: adopts silently only when no other room is stored; otherwise asks and keeps the old id", () => {
  let s = mem();
  assert.equal(adoptRoom("newroom", { storage: s, ask: () => assert.fail("no ask") }), "new");
  assert.equal(s.o[ROOM_KEY], "newroom");
  assert.equal(adoptRoom("newroom", { storage: s, ask: () => assert.fail("no ask") }), "same");
  assert.equal(adoptRoom("other", { storage: s, ask: () => false }), "declined");
  assert.equal(s.o[ROOM_KEY], "newroom");
  assert.equal(s.o[PREV_ROOM_KEY], undefined);
  assert.equal(adoptRoom("other", { storage: s, ask: () => true }), "adopted");
  assert.equal(s.o[ROOM_KEY], "other");
  assert.equal(s.o[PREV_ROOM_KEY], "newroom");
});
