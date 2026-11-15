// Static guards on firestore.rules (no emulator here): the tightened checks stay, and match what the app does.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COLLECTIONS, NO_DELETE } from "../js/store/store.js";
import { newId } from "../js/share/codec.js";

const rules = readFileSync("firestore.rules", "utf8");

test("rules: subcollection writes need a live room, a bounded room id and typed fields", () => {
  assert.match(rules, /exists\(p\) && !\('moved' in get\(p\)\.data\)/);
  assert.match(rules, /roomId\.size\(\) >= 20 && roomId\.size\(\) <= 40 && roomId\.matches\('\[a-z0-9\]\+'\)/);
  assert.match(rules, /&& idOk\(\) && docId\.size\(\) <= 64 && roomLive\(\)/);
  // Room doc is typed but has no key whitelist: migrate() keeps legacy keys, and a whitelist would refuse their saves.
  assert.match(rules, /function roomDocOk\(\)[\s\S]*?num\('v'\)[\s\S]*?obj\('settings'\)/);
  assert.doesNotMatch(rules, /hasOnly\(/);
});

test("rules: generated room ids satisfy the id rule", () => {
  const id = newId(24);
  assert.ok(id.length >= 20 && id.length <= 40 && /^[a-z0-9]+$/.test(id));
});

test("rules: every collection the store uses is listed, and NO_DELETE matches the delete rule", () => {
  for (const c of COLLECTIONS) assert.ok(rules.includes(`'${c}'`), c);
  const del = rules.match(/allow delete: if signedIn\(\)\s*&& col in \[([^\]]*)\]/)[1].match(/'(\w+)'/g).map((s) => s.slice(1, -1));
  assert.deepEqual(COLLECTIONS.filter((c) => !del.includes(c)).sort(), [...NO_DELETE].sort());
});
