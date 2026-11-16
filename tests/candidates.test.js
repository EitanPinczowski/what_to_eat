import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FOODS } from "../js/data/foods.js";
import { entityMedia, filterInfo, rank, politeClient, wikidataTerm, WIKIDATA, UA, categoryUrl } from "../tools/photo-lib.mjs";

const info = (title, o = {}) => ({
  index: o.index ?? 1, title,
  imageinfo: [{ thumburl: `https://t/${title}`, url: `https://f/${title}`, descriptionurl: `https://d/${title}`, mime: "image/jpeg", width: 1200, height: 1000,
    extmetadata: { LicenseShortName: { value: "CC BY 4.0" }, Artist: { value: "<b>Ann</b>" } }, ...o.ii }],
});

test("filterInfo keeps real, big, near-square, free, clean-titled jpgs", () => {
  const pages = {
    a: info("File:Pizza.jpg"),
    b: info("File:Pizza logo.jpg", { index: 2 }),
    c: info("File:Small.jpg", { index: 3, ii: { width: 500, height: 500 } }),
    d: info("File:Wide.jpg", { index: 4, ii: { width: 2000, height: 800 } }),
    e: info("File:Tall.jpg", { index: 5, ii: { width: 800, height: 1400 } }),
    f: info("File:Png.png", { index: 6, ii: { mime: "image/png" } }),
    g: info("File:NoLicense.jpg", { index: 7, ii: { extmetadata: { LicenseShortName: { value: "All rights reserved" } } } }),
    h: info("File:Wrapper pack.jpg", { index: 8 }),
  };
  const c = filterInfo({ query: { pages } }, "wikidata");
  assert.deepEqual(c.map((x) => x.title), ["File:Pizza.jpg"]);
  assert.deepEqual(Object.keys(c[0]).sort(), ["author", "fileUrl", "license", "page", "source", "thumbUrl", "title"]);
  assert.equal(c[0].author, "Ann");
  assert.deepEqual(filterInfo({}), []);
});

test("entityMedia reads P18 files and the P373 category", () => {
  const snak = (v) => [{ mainsnak: { datavalue: { value: v } } }];
  const m = entityMedia({ entities: { Q1: { id: "Q1", claims: {} }, Q2: { id: "Q2", claims: { P18: snak("A b.jpg"), P373: snak("Pizza") } } } });
  assert.deepEqual(m, { qid: "Q2", files: ["File:A b.jpg"], cat: "Pizza" });
  assert.equal(entityMedia({}).qid, null);
  assert.match(categoryUrl("Pizza"), /gcmtitle=Category%3APizza/);
});

test("rank dedupes by title, keeps priority order, caps at 6", () => {
  const mk = (t) => ({ title: t });
  const r = rank([[mk("a"), mk("b")], [mk("b"), mk("c"), mk("d"), mk("e"), mk("f"), mk("g"), mk("h")]]);
  assert.deepEqual(r.map((x) => x.title), ["a", "b", "c", "d", "e", "f"]);
});

test("politeClient: user agent, one at a time, Retry-After backoff on 429", async () => {
  const calls = [], sleeps = [];
  let n = 0, running = 0, maxRunning = 0;
  const fetchFn = async (url, init) => {
    running++; maxRunning = Math.max(maxRunning, running);
    calls.push(init.headers["User-Agent"]);
    await new Promise((r) => setImmediate(r));
    running--;
    if (++n === 1) return { status: 429, ok: false, headers: new Map([["retry-after", "7"]]) };
    return { status: 200, ok: true, json: async () => ({ ok: n }) };
  };
  const get = politeClient({ fetchFn, sleep: async (ms) => { sleeps.push(ms); }, gapMs: 0 });
  const [a, b] = await Promise.all([get("u1"), get("u2")]);
  assert.deepEqual([a.ok, b.ok], [2, 3]);
  assert.ok(sleeps.includes(7000));
  assert.equal(maxRunning, 1);
  assert.ok(calls.every((u) => u === UA) && !/@/.test(UA));
});

test("candidates.json: shape for every food, at most 6 each", () => {
  const c = JSON.parse(readFileSync(new URL("../tools/candidates.json", import.meta.url), "utf8"));
  for (const [id] of FOODS) {
    assert.ok(Array.isArray(c[id]), id);
    assert.ok(c[id].length <= 6, id);
    for (const x of c[id]) assert.ok(x.thumbUrl && x.fileUrl && x.title && x.license && x.page, id);
  }
});

test("override map only names real foods", () => {
  const ids = new Set(FOODS.map((f) => f[0]));
  for (const k of Object.keys(WIKIDATA)) assert.ok(ids.has(k), k);
  assert.equal(wikidataTerm("bamba"), "Bamba");
  assert.equal(wikidataTerm("pizza"), "pizza");
});
