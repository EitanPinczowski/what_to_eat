// localStorage Store: the no-Firebase fallback and the e2e mode (?store=local).
// Other tabs see changes through `storage` events.
import { Store, COLLECTIONS, mergeKeys } from "./store.js";
import { DB_KEY } from "../data/constants.js";

export class LocalStore extends Store {
  constructor(roomId, { storage = globalThis.localStorage, win = globalThis.window } = {}) {
    super(roomId);
    this.storage = storage;
    this.key = `${DB_KEY}:${roomId}`;
    win?.addEventListener?.("storage", (e) => {
      if (e.key !== this.key) return;
      const d = this._read();
      this._remote(d.room, d.cols);
    });
  }
  _read() {
    try {
      const d = JSON.parse(this.storage.getItem(this.key) ?? "null");
      if (d && typeof d === "object") return d;
    } catch {}
    return { room: null, cols: Object.fromEntries(COLLECTIONS.map((c) => [c, {}])) };
  }
  _write(d) {
    this.storage.setItem(this.key, JSON.stringify(d));
  }
  async _open() {
    return this._read();
  }
  async _writeRoom(room, keys) {
    const d = this._read();
    d.room = keys && d.room ? mergeKeys(d.room, room, keys) : room;
    this._write(d);
  }
  async _writeDoc(col, id, doc) {
    const d = this._read();
    d.cols[col] ??= {};
    if (doc) d.cols[col][id] = doc;
    else delete d.cols[col][id];
    this._write(d);
  }
}
