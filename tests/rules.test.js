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

test("rules: her never and fav lists are bounded lists of short strings (W4a)", () => {
  assert.ok(rules.includes("function strList(f, n)") && rules.includes("d[f] is list && d[f].size() <= n && d[f].join(',').size() <= n * 41"));
  assert.ok(rules.includes("strList('never', 30) && strList('fav', 30)"));
});

test("rules: place cuisines are a bounded list (F3)", () => {
  assert.match(rules, /function placeOk\(\)[\s\S]*?lst\('cuisines', 8\)/);
});

test("rules: history rejections are a bounded list and the inbox mark is a number (item 18)", () => {
  assert.match(rules, /function historyOk\(\)[\s\S]*?lst\('rej', 10\)[\s\S]*?num\('ib'\)/);
});

test("rules: live status sentAt, dead list and push receipt are typed (items 7–8)", () => {
  assert.match(rules, /function liveOk\(docId\)[\s\S]*?str\('sentAt', 40\) && lst\('dead', 8\) && obj\('push'\)/);
});

test("rules: events are create-only, with fixed keys, typed and bounded (item 29)", () => {
  const ev = rules.slice(rules.indexOf("function eventOk()"), rules.indexOf("match /events/"));
  assert.match(ev, /difference\(\['k', 'at'[^\]]*\]\.toSet\(\)\)\.size\(\) == 0/);
  assert.match(ev, /d\.k in \['sent', 'opened', 'step', 'guess', 'finish', 'vote', 'going', 'howItWas', 'push'\]/);
  assert.match(ev, /d\.at is string && d\.at\.size\(\) <= 40/);
  assert.match(ev, /d\.h >= 0 && d\.h <= 23/);
  assert.match(ev, /d\.d >= 0 && d\.d <= 6/);
  const m = rules.match(/match \/events\/\{eventId\} \{([\s\S]*?)\n      \}/)[1];
  assert.match(m, /allow create: if signedIn\(\) && idOk\(\) && eventId\.size\(\) <= 64 && roomLive\(\) && eventOk\(\)/);
  assert.match(m, /allow update: if false/);
  assert.match(m, /allow delete: if signedIn\(\)/);
  assert.doesNotMatch(m, /allow (create, )?update: if signedIn/);
});

test("rules: every event kind the app writes is allowed by the rule", async () => {
  const { EVENT_KINDS } = await import("../js/store/events.js");
  for (const k of EVENT_KINDS) assert.ok(rules.includes(`'${k}'`), k);
});
