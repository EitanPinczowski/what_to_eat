// Firestore Store (live). Modular SDK from gstatic, version pinned; offline cache on; anonymous auth.
// Layout: rooms/{roomId} (room doc) + subcollections (COLLECTIONS). See firestore.rules.
import { Store, COLLECTIONS } from "./store.js";

export const SDK_VERSION = "10.14.1";
const CDN = `https://www.gstatic.com/firebasejs/${SDK_VERSION}`;

export async function loadSdk() {
  const [app, auth, fs] = await Promise.all([
    import(`${CDN}/firebase-app.js`),
    import(`${CDN}/firebase-auth.js`),
    import(`${CDN}/firebase-firestore.js`),
  ]);
  return { ...app, ...auth, ...fs };
}

export class FirebaseStore extends Store {
  /** @param {object} config  public web config · @param {{sdk?: object}} opts  sdk injectable for tests */
  constructor(roomId, config, { sdk, fast = false, storage = globalThis.localStorage } = {}) {
    super(roomId);
    this.config = config;
    this.sdk = sdk;
    this.unsubs = [];
    this.fast = fast;
    this.storage = storage;
    this.snapKey = `wte.snap:${roomId}`;
    this._live = null;
    this._early = {};
    this._roomExists = false;
  }

  /**
   * fast: when this device saved a copy of THIS room last time, ready() resolves from it at once and the live
   * connection finishes in the background (its data then replaces the copy and subscribers are told).
   * Writes wait for the live connection. Without a saved copy it is the normal wait.
   */
  async _open() {
    const snap = this.fast ? this._readSnap() : null;
    if (!snap) {
      this._early = null;
      return this._openLive();
    }
    this._live = this._openLive().then(({ room, cols }) => {
      this._remote(room ? { ...room, ...this._early } : this.room, cols);
      this._early = null;
    });
    this._live.catch((e) => console.error("live connection failed", e));
    return snap;
  }

  _readSnap() {
    try {
      const d = JSON.parse(this.storage?.getItem(this.snapKey) ?? "null");
      if (d?.roomId === this.roomId && d.room && d.cols && !d.room.moved) return { room: d.room, cols: d.cols };
    } catch {} // harmless: skip
    return null;
  }

  _saveSnap() {
    if (!this.fast || this._snapTimer) return;
    this._snapTimer = setTimeout(() => {
      this._snapTimer = null;
      try {
        this.storage?.setItem(this.snapKey, JSON.stringify({ roomId: this.roomId, room: this.room, cols: this.cols }));
      } catch {} // harmless: skip
    }, 800);
  }

  _emit(what) {
    super._emit(what);
    this._saveSnap();
  }

  async _openLive() {
    const s = (this.sdk ??= await loadSdk());
    const app = s.initializeApp(this.config);
    let db;
    try {
      db = s.initializeFirestore(app, { localCache: s.persistentLocalCache({ tabManager: s.persistentMultipleTabManager() }) });
    } catch {
      db = s.getFirestore(app);
    }
    await s.signInAnonymously(s.getAuth(app));
    this.db = db;
    this.roomRef = s.doc(db, "rooms", this.roomId);

    // No getDocs: each listener's first snapshot carries the data.
    const first = COLLECTIONS.map((c) => new Promise((ok, no) => {
      let done = false;
      this.unsubs.push(s.onSnapshot(s.collection(this.roomRef, c), (qs) => {
        const docs = {};
        qs.forEach((d) => (docs[d.id] = d.data()));
        if (!done) return (done = true), ok(docs);
        if (!qs.metadata?.hasPendingWrites) this._remote(undefined, { [c]: docs });
      }, (e) => (c === "shopping" ? ok({}) : no(e))));
    }));
    const [snap, ...got] = await Promise.all([s.getDoc(this.roomRef), ...first]);
    const cols = Object.fromEntries(COLLECTIONS.map((c, i) => [c, got[i]]));
    this.unsubs.push(
      s.onSnapshot(this.roomRef, (d) => {
        if (!d.metadata?.hasPendingWrites && d.exists()) this._remote(d.data());
      }),
    );
    this._roomExists = snap.exists();
    return { room: snap.exists() ? snap.data() : null, cols };
  }

  /** keys = the changed top-level fields: sent as field updates, so a stale local copy cannot overwrite other fields. */
  async _writeRoom(room, keys) {
    if (keys && this._early) for (const k of keys) this._early[k] = room[k];
    await this._live;
    if (!keys || !this._roomExists) {
      await this.sdk.setDoc(this.roomRef, room, keys ? { merge: true } : undefined);
      this._roomExists = true;
      return;
    }
    const data = {};
    for (const k of keys) data[k] = k in room ? room[k] : this.sdk.deleteField();
    await this.sdk.updateDoc(this.roomRef, data);
  }

  async _writeDoc(col, id, doc) {
    await this._live;
    const ref = this.sdk.doc(this.roomRef, col, id);
    if (doc) await this.sdk.setDoc(ref, doc);
    else await this.sdk.deleteDoc(ref);
  }

  _track(col, write) {
    return super._track(col, () => write().catch((e) => (e?.code === "resource-exhausted" ? import("../busy.js").then((m) => m.retryBusy(write, e)) : Promise.reject(e))));
  }

  close() {
    clearTimeout(this._snapTimer);
    for (const u of this.unsubs) u();
    this.unsubs = [];
  }
}
