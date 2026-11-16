// Start-up speed guards: the modulepreload list in index.html matches the real static module graph,
// nothing heavy is imported statically by main.js, and the start-up code stays under a size budget.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { posix } from "node:path";

const ENTRIES = ["js/main.js", "js/ui/owner/app.js", "js/ui/guest/session.js", "js/store/firebase.js", "js/firebase-config.js"];

/** Files reached from `start` through static `import ... from` / `import "x"` only (dynamic import() loads on demand). */
function staticGraph(starts) {
  const seen = new Set();
  const walk = (f) => {
    if (seen.has(f)) return;
    seen.add(f);
    for (const m of readFileSync(f, "utf8").matchAll(/^(?:import|export)\s[^"'\n]*?from\s+["'](\.[^"']+)["']|^import\s+["'](\.[^"']+)["']/gm)) walk(posix.join(posix.dirname(f), m[1] ?? m[2]));
  };
  starts.forEach(walk);
  return seen;
}

const sizeOf = (files) => [...files].reduce((n, f) => n + statSync(f).size, 0);

test("index.html: modulepreload lists exactly the static start-up graph (main, owner home, her quiz, Firebase store)", () => {
  const html = readFileSync("index.html", "utf8");
  const listed = [...html.matchAll(/<link rel="modulepreload" href="([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(listed, [...staticGraph(ENTRIES)].sort(), "update the modulepreload links in index.html");
});

test("main.js: screens load on demand, not statically", () => {
  const main = readFileSync("js/main.js", "utf8");
  for (const f of ["ui/owner/app.js", "ui/guest/session.js", "ui/guest/sweep.js", "ui/guest/wrapped.js"]) assert.doesNotMatch(main, new RegExp(`^import .*${f.replace(/\./g, "\.")}`, "m"), f);
  assert.deepEqual([...staticGraph(["js/main.js"])].filter((f) => /ui\/owner\/(brain|places|shopping|settings|send-)/.test(f)), []);
});

test("owner home: heavy owner screens are not in its static graph", () => {
  const g = staticGraph(["js/ui/owner/app.js"]);
  for (const f of ["brain", "places", "shopping", "settings", "send-sweep", "send-wrapped"]) assert.ok(!g.has(`js/ui/owner/${f}.js`), f);
});

// Budgets sit a little above today's sizes (docs/REVIEW.md, item 20). Raise them on purpose, not by accident.
test("size budget: start-up graph and whole shell", () => {
  const start = sizeOf(staticGraph(ENTRIES));
  assert.ok(start <= 177 * 1024, `start-up modules ${start} bytes`);
  const sw = readFileSync("sw.js", "utf8");
  const shell = JSON.parse(sw.slice(sw.indexOf("const SHELL = ") + 14, sw.indexOf("];", sw.indexOf("const SHELL = ")) + 1)).filter((f) => f !== "./");
  const total = sizeOf(shell);
  assert.ok(total <= 300 * 1024, `shell ${total} bytes`);
  console.log(`# start-up ${start} B, shell ${total} B`);
});
