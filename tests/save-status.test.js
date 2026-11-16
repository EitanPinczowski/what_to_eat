// Item 6: the save marker follows the Store's pending writes; no empty catch hides a failed save.
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { MemoryStore } from "../js/store/memory.js";
import { saveStatus } from "../js/ui/dom.js";
import { STR } from "../js/data/strings.js";

const ROOM = "saveroom000000000000000";

function fakeTimers() {
  let n = 0;
  const q = new Map();
  return {
    set: (f) => (q.set(++n, f), n),
    clear: (id) => q.delete(id),
    fire: () => [...q.entries()].forEach(([id, f]) => (q.delete(id), f())),
    size: () => q.size,
  };
}

test("marker: waiting text only if the write is slow, saved text briefly, failure toasts and logs once", async () => {
  const s = await new MemoryStore(ROOM).ready();
  const shown = [];
  const failed = [];
  const t = fakeTimers();
  saveStatus(s, { show: (x) => shown.push(x), fail: (x) => failed.push(x) }, STR.save, { set: t.set, clear: t.clear });
  await s.update((db) => (db.inbox = ["x"])); // lands at once: the waiting text never shows
  assert.deepEqual(shown, [STR.save.saved]);
  t.fire();
  assert.deepEqual(shown, [STR.save.saved, null]);
  shown.length = 0;
  let land;
  s._writeDoc = () => new Promise((r) => (land = r));
  const w = s.put("live", "quiz", { step: 1 }); // offline: pending
  t.fire();
  assert.deepEqual(shown, [STR.save.pending]);
  land();
  await w;
  assert.equal(shown.at(-1), STR.save.saved);
  const okWrite = MemoryStore.prototype._writeDoc;
  s._writeDoc = async function (col, ...rest) {
    if (col === "errors") return okWrite.call(this, col, ...rest);
    throw new Error("denied");
  };
  await assert.rejects(s.put("history", "h1", { fn: "x" }));
  await assert.rejects(s.put("history", "h2", { fn: "y" }));
  assert.deepEqual(failed, [STR.save.fail, STR.save.fail]);
  await new Promise((r) => setTimeout(r, 5));
  const logged = s.list("errors");
  assert.equal(logged.length, 1, "logged once, not per failure");
  assert.match(logged[0].msg, /save failed: denied/);
  assert.equal(failed.length, 2, "the log write itself does not toast");
});

test("save strings exist and avoid gendered verbs", () => {
  for (const k of ["pending", "saved", "fail"]) assert.ok(STR.save[k]);
});

// A save path must never swallow an error silently. Harmless catches carry a `// harmless: why` on the same line.
function jsFiles(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? jsFiles(p) : p.endsWith(".js") ? [p] : [];
  });
}

test("no empty catch in js/ without a `// harmless:` comment on the same line", () => {
  const empty = /\.catch\(\s*(\(\s*\w*\s*\)|\w+)\s*=>\s*\{\s*\}\s*\)|catch\s*(\(\s*\w*\s*\))?\s*\{\s*\}/;
  const bad = [];
  for (const f of jsFiles("js"))
    readFileSync(f, "utf8").split("\n").forEach((l, i) => {
      if (empty.test(l) && !l.includes("// harmless:")) bad.push(`${f}:${i + 1}: ${l.trim().slice(0, 80)}`);
    });
  assert.deepEqual(bad, [], "use .catch(saveFailed) on save paths, or add `// harmless: why` if it truly is");
});
