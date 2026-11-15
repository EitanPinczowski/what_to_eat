// Every STR.<section>.<key> used through a `const X = STR.section` alias must exist (a missing key renders as a blank).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { STR } from "../js/data/strings.js";

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : f.endsWith(".js") ? [join(d, f)] : []));

test("string keys used through section aliases exist", () => {
  const missing = [];
  for (const file of walk("js/ui")) {
    const src = readFileSync(file, "utf8");
    for (const [, alias, sec] of src.matchAll(/const (\w+) = STR\.(\w+);/g)) {
      assert.ok(STR[sec], `${file}: STR.${sec} missing`);
      for (const [, key] of src.matchAll(new RegExp(String.raw`(?<![\w.])${alias}\.(\w+)`, "g"))) if (!(key in STR[sec])) missing.push(`${file}: ${alias}.${key} (STR.${sec})`);
    }
    for (const [, sec, key] of src.matchAll(/STR\.(\w+)\.(\w+)/g)) if (STR[sec] && typeof STR[sec] === "object" && !(key in STR[sec])) missing.push(`${file}: STR.${sec}.${key}`);
  }
  assert.deepEqual(missing, []);
});
