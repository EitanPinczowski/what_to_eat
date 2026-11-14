import { test } from "node:test";
import assert from "node:assert/strict";
import { encode, decode, newId } from "../js/share/codec.js";
import { buildQuizLink, buildSweepLink, buildJoinLink, buildResultLink, parseHash } from "../js/share/links.js";
import { normPhone, waUrl } from "../js/share/whatsapp.js";

test("codec round-trips Hebrew and emoji, url-safe", () => {
  const obj = { v: 1, h: "נגה", fe: "🍕", trail: ["מה בא לך? → 🧀"], n: 3 };
  const s = encode(obj);
  assert.match(s, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(decode(s), obj);
});

test("codec throws on corrupt input", () => {
  assert.throws(() => decode("!!!"));
  assert.throws(() => decode(encode({ a: 1 }).slice(0, -3)));
  assert.throws(() => decode(""));
});

test("newId is url-safe and sized", () => {
  const id = newId();
  assert.match(id, /^[a-z0-9]{12}$/);
  assert.notEqual(newId(), newId());
});

test("room links and parseHash", () => {
  const base = "https://x.github.io/what_to_eat/#old";
  assert.equal(buildQuizLink(base, "room123abc"), "https://x.github.io/what_to_eat/#q=room123abc");
  assert.deepEqual(parseHash("#q=room123abc"), { kind: "q", room: "room123abc" });
  assert.deepEqual(parseHash(new URL(buildSweepLink(base, "abcdef12")).hash), { kind: "s", room: "abcdef12" });
  assert.deepEqual(parseHash(new URL(buildJoinLink(base, "abcdef12")).hash), { kind: "join", room: "abcdef12" });
  assert.deepEqual(parseHash(""), { kind: "home" });
  assert.deepEqual(parseHash("#q=<script>"), { kind: "bad" });
  assert.deepEqual(parseHash("#zzz=1"), { kind: "bad" });
});

test("result link carries a versioned payload under 4 KB", () => {
  const p = { t: "quiz", id: "r1", fn: "פיצה", fe: "🍕", trail: Array(12).fill("איזה מרקם בא לך? → 🧀 גבינה נמתחת") };
  const url = buildResultLink("https://x.io/", p);
  assert.ok(url.length < 4096);
  const r = parseHash(new URL(url).hash);
  assert.equal(r.kind, "r");
  assert.equal(r.payload.v, 1);
  assert.equal(r.payload.fn, "פיצה");
  assert.deepEqual(parseHash("#r=" + encode({ v: 2, id: "x" })), { kind: "bad" });
  assert.deepEqual(parseHash("#r=abc"), { kind: "bad" });
});

test("normPhone and waUrl", () => {
  assert.equal(normPhone("050-123-4567"), "972501234567");
  assert.equal(normPhone("+972 50 123 4567"), "972501234567");
  assert.equal(normPhone("00972501234567"), "972501234567");
  assert.equal(normPhone(""), "");
  assert.equal(waUrl("שלום", "0501234567"), "https://wa.me/972501234567?text=%D7%A9%D7%9C%D7%95%D7%9D");
  assert.equal(waUrl("hi"), "https://wa.me/?text=hi");
});
