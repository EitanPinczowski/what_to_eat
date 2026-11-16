import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { posix } from "node:path";
import { installKind, installHelp, registerSW } from "../js/pwa.js";
import { png } from "../tools/make-icons.mjs";
import { STR } from "../js/data/strings.js";

test("manifest: valid JSON, RTL Hebrew, icons exist (incl. maskable)", () => {
  const m = JSON.parse(readFileSync("manifest.webmanifest", "utf8"));
  assert.equal(m.dir, "rtl");
  assert.equal(m.display, "standalone");
  assert.ok(m.icons.some((i) => i.purpose === "maskable"));
  for (const i of m.icons) assert.ok(existsSync(i.src), i.src);
  assert.ok(existsSync("img/icons/apple-180.png"));
  const html = readFileSync("index.html", "utf8");
  assert.match(html, /rel="manifest"/);
  assert.match(html, /apple-touch-icon/);
});

const shellOf = (sw) => JSON.parse(sw.slice(sw.indexOf("const SHELL = ") + 14, sw.indexOf("];", sw.indexOf("const SHELL = ")) + 1));

test("sw.js: version placeholder for the deploy stamp, shell files exist", () => {
  const sw = readFileSync("sw.js", "utf8");
  assert.match(sw, /const VERSION = "__VERSION__"/);
  const shell = shellOf(sw);
  for (const f of shell) if (f !== "./") assert.ok(existsSync(f), f);
  assert.match(readFileSync(".github/workflows/ci.yml", "utf8"), /__VERSION__/);
});

test("installKind: iOS, Android, installed, other", () => {
  const win = (standalone = false) => ({ matchMedia: () => ({ matches: standalone }) });
  assert.equal(installKind({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" }, win()), "ios");
  assert.equal(installKind({ userAgent: "Mozilla/5.0 (Macintosh)", maxTouchPoints: 5 }, win()), "ios");
  assert.equal(installKind({ userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8)" }, win()), "android");
  assert.equal(installKind({ userAgent: "Mozilla/5.0 (Linux; Android 14)" }, win(true)), "installed");
  assert.equal(installKind({ userAgent: "x", standalone: true }, win()), "installed");
  assert.equal(installKind({ userAgent: "Mozilla/5.0 (Windows NT 10.0)" }, win()), "other");
  assert.equal(installHelp("ios"), STR.install.ios);
  assert.equal(installHelp("nope"), STR.install.other);
});

test("registerSW: skipped without service workers and on localhost", async () => {
  assert.equal(await registerSW(() => {}, {}, { location: { protocol: "https:", hostname: "x.github.io", search: "" } }), null);
  let called = false;
  const nav = { serviceWorker: { register: async () => ((called = true), null) } };
  assert.equal(await registerSW(() => {}, nav, { location: { protocol: "http:", hostname: "localhost", search: "" } }), null);
  assert.equal(called, false);
});

test("registerSW: offers the update only when a worker waits and a page is controlled", async () => {
  const posted = [];
  const waiting = { postMessage: (m) => posted.push(m) };
  const reg = { waiting, addEventListener() {}, update: async () => {} };
  const nav = { serviceWorker: { controller: {}, register: async () => reg, addEventListener() {} } };
  let apply = null;
  await registerSW((a) => (apply = a), nav, { location: { protocol: "https:", hostname: "x.github.io", search: "" }, document: { addEventListener() {} } });
  assert.ok(apply);
  apply();
  assert.deepEqual(posted, ["skipWaiting"]);
  // First install (no controller yet): no toast.
  apply = null;
  nav.serviceWorker.controller = null;
  await registerSW((a) => (apply = a), nav, { location: { protocol: "https:", hostname: "x.github.io", search: "" }, document: { addEventListener() {} } });
  assert.equal(apply, null);
});

test("icon PNG: signature and size", () => {
  const b = png(48);
  assert.deepEqual([...b.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(b.readUInt32BE(16), 48);
  assert.equal(b.readUInt32BE(20), 48);
});

test("sw.js: every module reachable from js/main.js is precached (one deploy = one version)", () => {
  const shell = new Set(shellOf(readFileSync("sw.js", "utf8")));
  const seen = new Set();
  const walk = (f) => {
    if (seen.has(f)) return;
    seen.add(f);
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/(?:from\s+|import\s*\(\s*|^import\s+)["'](\.[^"']+)["']/gm)) walk(posix.join(posix.dirname(f), m[1]));
  };
  walk("js/main.js");
  assert.ok(seen.size > 30);
  assert.deepEqual([...seen].filter((f) => !shell.has(f)), [], "add these to SHELL in sw.js");
});

test("sw.js: only the app root and index.html map to the cached app shell", () => {
  const sw = readFileSync("sw.js", "utf8");
  const src = sw.split("\n").find((l) => l.includes("const appPage"));
  const re = new Function("return " + src.slice(src.indexOf("&& ") + 3, src.indexOf(".test(")))();
  for (const ok of ["/", "/what_to_eat/", "/what_to_eat/index.html", "/index.html"]) assert.ok(re.test(ok), ok);
  for (const no of ["/credits.html", "/what_to_eat/credits.html", "/x/xindex.html"]) assert.ok(!re.test(no), no);
});
