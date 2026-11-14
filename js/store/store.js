// Store interface (PLAN.md §5.3, spec-flow-firebase.md §2.2). UI and engine reach data only through a Store.
// Room doc = settings, ratings, custom foods, inbox, learned weights, imported ids.
// Subcollections: history, places, live, feedback, errors.
export const SCHEMA = 1;
export const COLLECTIONS = ["history", "places", "live", "feedback", "errors"];
const MAX_IMPORTED = 200;
const MAX_ERRORS = 50;

export function emptyRoom() {
  return {
    v: SCHEMA,
    settings: { her: "נגה", me: "איתן", myPhone: "", base: "", city: "", ntfy: "" },
    ratings: {},
    custom: [],
    inbox: [],
    learned: {},
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

const clone = (x) => (x === undefined ? x : JSON.parse(JSON.stringify(x)));

/**
 * Shared logic. Subclasses implement:
 *   _open() → Promise<{room, cols}>   initial load (cols: {name: {id: doc}})
 *   _writeRoom(room) → Promise
 *   _writeDoc(col, id, doc|null) → Promise   (null = delete)
 * and call this._remote(room, cols) when data changes elsewhere.
 */
export class Store {
  constructor(roomId) {
    this.roomId = roomId;
    this.room = emptyRoom();
    this.cols = Object.fromEntries(COLLECTIONS.map((c) => [c, {}]));
    this.subs = new Set();
    this._ready = null;
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

  /** Mutate the room doc and persist it. */
  async update(fn) {
    const next = clone(this.room);
    fn(next);
    this.room = migrate(next);
    this._emit("room");
    await this._writeRoom(clone(this.room));
  }

  /** Docs of a subcollection, newest first by `at` when present. */
  list(col) {
    this._check(col);
    return Object.entries(this.cols[col])
      .map(([id, d]) => ({ ...clone(d), id }))
      .sort((a, b) => String(b.at ?? "").localeCompare(String(a.at ?? "")));
  }

  doc(col, id) {
    this._check(col);
    const d = this.cols[col][id];
    return d ? { ...clone(d), id } : null;
  }

  async put(col, id, doc) {
    this._check(col);
    const { id: _ignored, ...data } = clone(doc);
    this.cols[col][id] = data;
    this._emit(col);
    await this._writeDoc(col, id, data);
  }

  async remove(col, id) {
    this._check(col);
    delete this.cols[col][id];
    this._emit(col);
    await this._writeDoc(col, id, null);
  }

  /** cb(what) on any change: 'room' or a collection name. Returns unsubscribe. */
  subscribe(cb) {
    this.subs.add(cb);
    return () => this.subs.delete(cb);
  }

  /** Import a #r= fallback payload. Dedupe by payload.id. */
  async importResult(p) {
    if (!p?.id || this.room.imported.includes(p.id) || this.cols.history[p.id]) return { fresh: false };
    if (p.t === "rate") {
      await this.update((db) => {
        for (const [id, r] of Object.entries(p.r ?? {})) {
          db.ratings[id] = { r };
          if (p.n?.[id]) db.ratings[id].n = String(p.n[id]).slice(0, 200);
        }
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
    });
    return { fresh: true };
  }

  /** Append to the error log, keeping the newest 50. */
  async logError(e) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await this.put("errors", id, { at: new Date().toISOString(), ...e });
    for (const d of this.list("errors").slice(MAX_ERRORS)) await this.remove("errors", d.id);
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

  // ---- for subclasses ----
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
