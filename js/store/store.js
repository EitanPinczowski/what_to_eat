// Store interface (PLAN.md §5.3, spec-flow-firebase.md §2.2). UI and engine reach data only through a Store.
// Room doc = settings, ratings, custom foods, inbox, learned weights, imported ids.
import { FOODS } from "../data/foods.js";
import { MODES } from "../data/constants.js";
import { buildFoods } from "../engine/foods.js";
import { cuisinesOfFoods } from "../places/cuisine.js";
export const SCHEMA = 1;
export const COLLECTIONS = ["history", "places", "live", "feedback", "errors", "shopping"];
/** Eitan's one-tap replies to her sent result. Stored as a short code in live/quiz.ack (no rules change needed). */
export const ACK_CODES = ["seen", "ordered", "onway", "there"];
/** Her place vote (live/vote): Eitan offers 2-3 place ids, she picks one or this "neither" code. Short fields only. */
export const VOTE_NONE = "x";
export const VOTE_MIN = 2;
export const VOTE_MAX = 3;
const MAX_IMPORTED = 200;
const MAX_ERRORS = 50;
const MAX_SHOPPING = 200;

export function emptyRoom() {
  return {
    v: SCHEMA,
    settings: { her: "נגה", me: "איתן", myPhone: "", base: "", city: "", ntfy: "" },
    ratings: {},
    custom: [],
    inbox: [],
    learned: {},
    exp: {},
    imported: [],
  };
}

/** Bring an older or partial room doc up to the current schema. */
export function migrate(room) {
  const r = { ...emptyRoom(), ...(room ?? {}) };
  r.settings = { ...emptyRoom().settings, ...(room?.settings ?? {}) };
  r.v = SCHEMA;
  return r;
}

/** Subcollections whose docs the rules do not let a client delete. Empty since item 11 (the logs can be trimmed). */
export const NO_DELETE = [];
const TOMBSTONE = ["feedback", "errors"];

/** Log collections the owner may trim, and how many docs are kept on start. */
export const LOGS = ["errors", "feedback"];
export const LOG_KEEP = 200;

const isStr = (x, n) => typeof x === "string" && x.length <= n;
const MAX_RATES = 400;

export function cleanResult(p, knownIds = new Set(FOODS.map((f) => f[0]))) {
  if (!p || typeof p !== "object" || !isStr(p.id, 40) || !/^[A-Za-z0-9_-]+$/.test(p.id)) return null;
  if (p.t === "rate") {
    if (!p.r || typeof p.r !== "object" || Array.isArray(p.r)) return null;
    const ids = Object.keys(p.r);
    if (!ids.length || ids.length > MAX_RATES) return null;
    for (const id of ids) if (!knownIds.has(id) || !Number.isInteger(p.r[id]) || p.r[id] < 1 || p.r[id] > 4) return null;
    const n = {};
    if (p.n !== undefined) {
      if (!p.n || typeof p.n !== "object" || Array.isArray(p.n)) return null;
      for (const [id, t] of Object.entries(p.n)) {
        if (!(id in p.r) || !isStr(t, 200)) return null;
        if (t) n[id] = t;
      }
    }
    const x = p.x ?? [];
    if (!Array.isArray(x) || x.length > 30 || x.some((t) => !isStr(t, 40))) return null;
    return { t: "rate", id: p.id, r: { ...p.r }, n, x: x.filter(Boolean) };
  }
  if (p.f != null && (!isStr(p.f, 40) || !knownIds.has(p.f))) return null;
  if (!isStr(p.fn, 80) || (p.fe !== undefined && !isStr(p.fe, 32))) return null;
  if (p.at !== undefined && (!isStr(p.at, 40) || Number.isNaN(Date.parse(p.at)))) return null;
  if (p.m !== undefined && !MODES.includes(p.m)) return null;
  if (p.price != null && (!Number.isInteger(p.price) || p.price < 1 || p.price > 4)) return null;
  if (p.note !== undefined && !isStr(p.note, 300)) return null;
  const trail = p.trail ?? [];
  if (!Array.isArray(trail) || trail.length > 40 || trail.some((s) => !isStr(s, 120))) return null;
  return { t: "quiz", id: p.id, at: p.at, f: p.f ?? null, fn: p.fn, fe: p.fe ?? "", m: p.m, price: p.price ?? null, note: p.note ?? "", trail };
}

const clone = (x) => (x === undefined ? x : JSON.parse(JSON.stringify(x)));

/** Structural equality for plain JSON values (key order does not matter). */
export function deepEqual(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object" || Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => k in b && deepEqual(a[k], b[k]));
}

/** Top-level keys whose value differs between two room docs (added, changed or removed). */
export function changedKeys(before, after) {
  return [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].filter((k) => !deepEqual(before?.[k], after?.[k]));
}

/** The stored room doc with only `keys` taken from `room` (a key missing from `room` is removed). */
export function mergeKeys(stored, room, keys) {
  const out = { ...stored };
  for (const k of keys) {
    if (k in room) out[k] = room[k];
    else delete out[k];
  }
  return out;
}

export class Store {
  constructor(roomId) {
    this.roomId = roomId;
    this.room = emptyRoom();
    this.cols = Object.fromEntries(COLLECTIONS.map((c) => [c, {}]));
    this.subs = new Set();
    this.saveSubs = new Set();
    this.pending = 0;
    this._ready = null;
  }

  /** cb({state: "pending"|"saved"|"error", pending, col?, error?}) whenever a write starts, lands or fails. Returns unsubscribe. */
  onSave(cb) {
    this.saveSubs.add(cb);
    return () => this.saveSubs.delete(cb);
  }

  _emitSave(state, extra = {}) {
    for (const cb of this.saveSubs) {
      try {
        cb({ state, pending: this.pending, ...extra });
      } catch (e) {
        console.error(e);
      }
    }
  }

  /** Run a write, counting it as pending until it lands. A failure is reported to onSave and rethrown. */
  async _track(col, write) {
    this.pending++;
    this._emitSave("pending", { col });
    try {
      await write();
    } catch (error) {
      this.pending--;
      this._emitSave("error", { col, error });
      throw error;
    }
    this.pending--;
    this._emitSave(this.pending ? "pending" : "saved", { col });
  }

  ready() {
    this._ready ??= this._open().then(({ room, cols } = {}) => {
      this.room = migrate(room);
      for (const c of COLLECTIONS) this.cols[c] = { ...(cols?.[c] ?? {}) };
      return this;
    });
    return this._ready;
  }

  /** Current room doc (a copy). */
  get() {
    return clone(this.room);
  }

  /** True once this room was retired by "rotate key" (its data moved to a new room id). */
  get moved() {
    return !!this.room.moved;
  }

  async retire(at = new Date().toISOString()) {
    const ops = [];
    for (const c of COLLECTIONS)
      for (const id of Object.keys(this.cols[c])) {
        ops.push(TOMBSTONE.includes(c) ? this._writeDoc(c, id, { moved: true, at }) : this._writeDoc(c, id, null));
        this.cols[c] = {};
      }
    await Promise.allSettled(ops);
    this.room = migrate({ moved: true, at });
    await this._writeRoom({ v: SCHEMA, moved: true, at });
  }

  /** Mutate the room doc and persist it. Only the top-level keys that changed are written (item 5). */
  async update(fn) {
    const before = this.room;
    const next = clone(before);
    fn(next);
    this.room = migrate(next);
    this._emit("room");
    const keys = changedKeys(before, this.room);
    if (keys.length) await this._track("room", () => this._writeRoom(clone(this.room), keys));
  }

  /** Docs of a subcollection, newest first by `at` when present. */
  list(col) {
    this._check(col);
    return Object.entries(this.cols[col])
      .map(([id, d]) => this._view(col, { ...clone(d), id }))
      .sort((a, b) => String(b.at ?? "").localeCompare(String(a.at ?? "")));
  }

  doc(col, id) {
    this._check(col);
    const d = this.cols[col][id];
    return d ? this._view(col, { ...clone(d), id }) : null;
  }

  /** Read-path migration: a place without cuisines gets them from its (kept) food list. */
  _view(col, d) {
    if (col === "places" && !Array.isArray(d.cuisines)) d.cuisines = cuisinesOfFoods(d.foods, buildFoods(FOODS, this.room?.custom ?? []));
    return d;
  }

  async put(col, id, doc) {
    this._check(col);
    const { id: _ignored, ...data } = clone(doc);
    const prev = this.cols[col][id];
    this.cols[col][id] = data;
    this._emit(col);
    import("./events.js").then((m) => m.record(this, col, id, data, prev)).catch(() => {}); // harmless: optional log
    await this._track(col, () => this._writeDoc(col, id, data));
  }

  /** Set (or clear with null) Eitan's reply code on her finished live doc. Unknown codes are ignored. */
  async setAck(code) {
    if (code !== null && !ACK_CODES.includes(code)) return false;
    const cur = this.doc("live", "quiz");
    if (!cur?.finished) return false;
    const { id: _id, ack: _old, ...rest } = cur;
    await this.put("live", "quiz", code ? { ...rest, ack: code, ackAt: new Date().toISOString() } : rest);
    return true;
  }

  /** The current place vote as {ids, names, pick, at, pickAt} or null. pick: a place id, VOTE_NONE or null (not answered yet). */
  vote() {
    const d = this.doc("live", "vote");
    if (!d || !Array.isArray(d.o) || !d.o.length) return null;
    const pick = d.p === VOTE_NONE || d.o.includes(d.p) ? d.p : null;
    return { ids: d.o, names: d.n ?? [], pick, at: d.at ?? "", pickAt: d.pAt ?? "" };
  }

  /** Eitan sends 2-3 of his saved places for her to vote on. Replaces any earlier vote. Returns false when the ids are not 2-3 known places. */
  async sendVote(placeIds) {
    const ids = [...new Set(placeIds ?? [])].filter((id) => this.cols.places[id]);
    if (ids.length < VOTE_MIN || ids.length > VOTE_MAX) return false;
    await this.put("live", "vote", { o: ids, n: ids.map((id) => String(this.cols.places[id].name ?? "").slice(0, 40)), at: new Date().toISOString() });
    return true;
  }

  /** Her answer: one of the offered place ids, or VOTE_NONE. She may change her mind. */
  async castVote(code) {
    const v = this.vote();
    if (!v || (code !== VOTE_NONE && !v.ids.includes(code))) return false;
    await this.put("live", "vote", { o: v.ids, n: v.names, at: v.at, p: code, pAt: new Date().toISOString() });
    return true;
  }

  async clearVote() {
    if (this.cols.live.vote) await this.remove("live", "vote");
  }

  /** Shared shopping list, oldest first: [{id, text, done, addedAt, recipe}]. */
  shopping() {
    return Object.entries(this.cols.shopping)
      .map(([id, d]) => ({ ...clone(d), id }))
      .sort((a, b) => String(a.addedAt ?? "").localeCompare(String(b.addedAt ?? "")) || a.id.localeCompare(b.id));
  }

  /** Add lines to the list. Skips a line that is already waiting (not ticked) on the list. Returns how many were added. */
  async addShopping(lines, recipe = "") {
    const open = new Set(this.shopping().filter((i) => !i.done).map((i) => i.text));
    const at = new Date().toISOString();
    let n = 0;
    for (const raw of lines ?? []) {
      const text = String(raw ?? "").trim().slice(0, 120);
      if (!text || open.has(text) || this.shopping().length >= MAX_SHOPPING) continue;
      open.add(text);
      const id = `${Date.now().toString(36)}${n.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      await this.put("shopping", id, { text, done: false, addedAt: at, recipe: String(recipe ?? "").slice(0, 80) });
      n++;
    }
    return n;
  }

  /** Tick or untick one item (done = true/false; omit to flip). */
  async tickShopping(id, done) {
    const d = this.doc("shopping", id);
    if (!d) return false;
    const { id: _id, ...rest } = d;
    await this.put("shopping", id, { ...rest, done: done ?? !d.done });
    return true;
  }

  /** Remove every ticked item. Returns how many were removed. */
  async clearDoneShopping() {
    const done = this.shopping().filter((i) => i.done);
    for (const i of done) await this.remove("shopping", i.id);
    return done.length;
  }

  async remove(col, id) {
    this._check(col);
    delete this.cols[col][id];
    this._emit(col);
    await this._track(col, () => this._writeDoc(col, id, null));
  }

  /** cb(what) on any change: 'room' or a collection name. Returns unsubscribe. */
  subscribe(cb) {
    this.subs.add(cb);
    return () => this.subs.delete(cb);
  }

  /** Look at a #r= payload before applying it: {clean} (validated copy), {dup:true} (already imported) or {bad:true}. */
  checkResult(p) {
    const known = new Set([...FOODS.map((f) => f[0]), ...(this.room.custom ?? []).map((c) => c?.id).filter(Boolean)]);
    const clean = cleanResult(p, known);
    if (!clean) return { bad: true };
    if (this.room.imported.includes(clean.id) || this.cols.history[clean.id]) return { dup: true };
    return { clean };
  }

  /** Import a #r= fallback payload (validated again here). Dedupe by payload.id. */
  async importResult(raw) {
    const chk = this.checkResult(raw);
    if (!chk.clean) return { fresh: false };
    const p = chk.clean;
    if (p.t === "rate") {
      await this.update((db) => {
        for (const [id, r] of Object.entries(p.r ?? {})) {
          db.ratings[id] = { r };
          if (p.n?.[id]) db.ratings[id].n = String(p.n[id]).slice(0, 200);
        }
        for (const t of p.x ?? []) if (t && !db.inbox.includes(t)) db.inbox.push(String(t).slice(0, 40));
        db.inbox = db.inbox.slice(-300);
        db.imported = [p.id, ...db.imported].slice(0, MAX_IMPORTED);
      });
      return { fresh: true };
    }
    const entry = {
      at: p.at ?? new Date().toISOString(),
      f: p.f ?? null,
      fn: String(p.fn ?? "").slice(0, 80),
      fe: p.fe ?? "",
      m: p.m ?? "any",
      price: p.price ?? null,
      note: String(p.note ?? "").slice(0, 300),
      trail: (p.trail ?? []).slice(0, 40).map((s) => String(s).slice(0, 120)),
      src: "link",
    };
    await this.put("history", p.id, entry);
    await this.update((db) => {
      db.imported = [p.id, ...db.imported].slice(0, MAX_IMPORTED);
      if (!entry.f && entry.fn && !db.inbox.includes(entry.fn)) db.inbox.push(entry.fn);
      db.inbox = db.inbox.slice(-300);
    });
    return { fresh: true };
  }

  /** Item 18: her typed "something else" (history entries with no food id) reaches the inbox once; the entry is marked `ib`. */
  async collectInbox() {
    const todo = this.list("history").filter((h) => !h.f && h.fn && !h.ib && h.src !== "link");
    if (!todo.length) return 0;
    await this.update((db) => {
      for (const h of todo) if (!db.inbox.includes(h.fn)) db.inbox.push(h.fn);
      db.inbox = db.inbox.slice(-300);
    });
    for (const h of todo) await this.put("history", h.id, { ...h, ib: 1 });
    return todo.length;
  }

  /** Append to the error log, keeping the newest 50. */
  async logError(e) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await this.put("errors", id, { at: new Date().toISOString(), ...e });
    for (const d of this.list("errors").slice(MAX_ERRORS)) await this.remove("errors", d.id);
  }

  /** Delete the oldest docs of the log collections beyond `keep` (newest kept). Returns how many were removed. */
  async trimLogs(keep = LOG_KEEP) {
    let n = 0;
    for (const c of LOGS)
      for (const d of this.list(c).slice(keep)) (await this.remove(c, d.id), n++);
    return n;
  }

  /** Delete every doc of one log collection ("errors" | "feedback"). Returns how many were removed. */
  async clearLog(col) {
    if (!LOGS.includes(col)) throw new Error(`not a log: ${col}`);
    const all = this.list(col);
    for (const d of all) await this.remove(col, d.id);
    return all.length;
  }

  exportJSON() {
    return JSON.stringify({ v: SCHEMA, room: this.room, cols: this.cols }, null, 1);
  }

  async importJSON(json) {
    const data = JSON.parse(json);
    if (!data || typeof data !== "object" || !data.room) throw new Error("bad backup");
    await this.update((db) => Object.assign(db, migrate(data.room)));
    for (const c of COLLECTIONS)
      for (const [id, d] of Object.entries(data.cols?.[c] ?? {})) await this.put(c, id, d);
  }

  _remote(room, cols) {
    if (room !== undefined) {
      this.room = migrate(room);
      this._emit("room");
    }
    for (const [c, docs] of Object.entries(cols ?? {})) {
      if (!COLLECTIONS.includes(c)) continue;
      this.cols[c] = { ...docs };
      this._emit(c);
    }
  }
  _emit(what) {
    for (const cb of this.subs) {
      try {
        cb(what);
      } catch (e) {
        console.error(e);
      }
    }
  }
  _check(col) {
    if (!COLLECTIONS.includes(col)) throw new Error(`unknown collection ${col}`);
  }
  async _open() {
    return {};
  }
  async _writeRoom() {}
  async _writeDoc() {}
}
