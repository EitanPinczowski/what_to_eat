// In-memory Store for unit tests. Stores sharing one `shared` object see each other's writes.
import { Store, COLLECTIONS, mergeKeys } from "./store.js";

const copy = (x) => JSON.parse(JSON.stringify(x));

export class MemoryStore extends Store {
  constructor(roomId = "memoryroom0000000000000", shared = { rooms: {} }) {
    super(roomId);
    this.shared = shared;
    shared.peers ??= new Set();
    shared.peers.add(this);
  }
  _data() {
    return (this.shared.rooms[this.roomId] ??= { room: null, cols: Object.fromEntries(COLLECTIONS.map((c) => [c, {}])) });
  }
  async _open() {
    const d = this._data();
    return copy({ room: d.room, cols: d.cols });
  }
  async _writeRoom(room, keys) {
    const d = this._data();
    d.room = keys && d.room ? mergeKeys(d.room, room, keys) : room;
    this._fanout(true);
  }
  async _writeDoc(col, id, doc) {
    const d = this._data();
    if (doc) d.cols[col][id] = doc;
    else delete d.cols[col][id];
    this._fanout(false, col);
  }
  _fanout(room, col) {
    const d = this._data();
    for (const p of this.shared.peers)
      if (p !== this && p.roomId === this.roomId)
        p._remote(room ? copy(d.room) : undefined, col ? { [col]: copy(d.cols[col]) } : undefined);
  }
}
