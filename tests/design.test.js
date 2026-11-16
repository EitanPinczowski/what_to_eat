// Item 25: the design system is checkable from the CSS text alone.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const tokens = readFileSync("css/tokens.css", "utf8");
const style = readFileSync("css/style.css", "utf8");
const rules = (css) => [...css.replace(/\/\*[^]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), body: m[2] }));
const lum = (h) => {
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

test("type scale: exactly six size tokens, and every font-size uses them", () => {
  const sizes = [...tokens.matchAll(/--t(\d):/g)].map((m) => m[1]);
  assert.deepEqual(sizes, ["1", "2", "3", "4", "5", "6"]);
  const decl = [...style.matchAll(/font-size:\s*([^;}]+)/g)].map((m) => m[1].trim());
  assert.ok(decl.length > 20);
  for (const d of decl) assert.match(d, /^(var\(--t[1-6]\)|calc\(var\(--t6\) \* [\d.]+\))$/, `font-size: ${d}`);
  assert.doesNotMatch(tokens, /font-size/);
});

test("tap size: --tap is 48px and .btn / .chip / .row use it as min-height", () => {
  assert.match(tokens, /--tap:\s*48px/);
  for (const k of [".btn", ".chip", ".row"]) {
    const r = rules(style).find((x) => x.sel.split(",").map((s) => s.trim()).includes(k) && /min-height:\s*var\(--tap\)/.test(x.body));
    assert.ok(r, `${k} needs min-height: var(--tap)`);
  }
});

test("dark mode: the border token is visible (3:1) on the page and on cards", () => {
  const dark = tokens.slice(tokens.indexOf("prefers-color-scheme: dark"));
  const get = (n) => dark.match(new RegExp(`--${n}:\\s*(#[0-9A-Fa-f]{6})`))[1];
  assert.ok(contrast(get("line"), get("bg")) >= 3, "line on bg");
  assert.ok(contrast(get("line"), get("card")) >= 3, "line on card");
  assert.match(tokens, /--border:\s*2px solid var\(--line\)/);
});

test("one selected state: accent + check mark for aria-pressed and .is-selected", () => {
  assert.match(style, /\[aria-pressed="true"\], \.is-selected \{[^}]*border-color: var\(--accent\)/);
  assert.match(style, /\[aria-pressed="true"\]::after, \.is-selected::after \{[^}]*content: "✓"/);
});

test("themed controls and no outline box on headings", () => {
  assert.match(style, /accent-color: var\(--accent\)/);
  assert.match(style, /h2:focus[^{]*\{ outline: none/);
});
