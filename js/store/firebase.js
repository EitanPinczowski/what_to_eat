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
  }

  /**
   * fast: when this device saved a copy of THIS room last time, ready() resolves from it at once and the live
   * connection finishes in the background (its data then replaces the copy and subscribers are told).
   * Writes wait for the live connection. Without a saved copy it is the normal wait.
   */
  async _open() {
    const snap = this.fast ? this._readSnap() : null;
    if (!snap) return this._openLive();
    this._live = this._openLive().then(({ room, cols }) => {
      this._remote(room ?? this.room, cols);
    });
    this._live.catch((e) => console.error("live connection failed", e));
    return snap;
  }

  _readSnap() {
    try {
      const d = JSON.parse(this.storage?.getItem(this.snapKey) ?? "null");
      if (d?.roomId === this.roomId && d.room && d.cols && !d.room.moved) return { room: d.room, cols: d.cols };
    } catch {}
    return null;
  }

  _saveSnap() {
    if (!this.fast || this._snapTimer) return;
    this._snapTimer = setTimeout(() => {
      this._snapTimer = null;
      try {
        this.storage?.setItem(this.snapKey, JSON.stringify({ roomId: this.roomId, room: this.room, cols: this.cols }));
      } catch {}
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
      db = s.getFirestore(app); // offline cache unavailable (private mode, old Safari)
    }
    await s.signInAnonymously(s.getAuth(app));
    this.db = db;
    this.roomRef = s.doc(db, "rooms", this.roomId);

    // The room doc and every collection are read in parallel.
    const [snap, ...got] = await Promise.all([
      s.getDoc(this.roomRef),
      ...COLLECTIONS.map((c) =>
        s.getDocs(s.collection(this.roomRef, c)).catch((e) => {
          // A collection the published rules do not allow yet (e.g. shopping before the rules are re-published) must not break the app.
          if (c !== "shopping") throw e;
          return null;
        }),
      ),
    ]);
    const cols = {};
    COLLECTIONS.forEach((c, i) => {
      cols[c] = {};
      got[i]?.forEach((d) => (cols[c][d.id] = d.data()));
    });

    this.unsubs.push(
      s.onSnapshot(this.roomRef, (d) => {
        if (!d.metadata?.hasPendingWrites && d.exists()) this._remote(d.data());
      }),
    );
    for (const c of COLLECTIONS)
      this.unsubs.push(
        s.onSnapshot(s.collection(this.roomRef, c), (qs) => {
          if (qs.metadata?.hasPendingWrites) return;
          const docs = {};
          qs.forEach((d) => (docs[d.id] = d.data()));
          this._remote(undefined, { [c]: docs });
        }, () => {}),
      );
    return { room: snap.exists() ? snap.data() : null, cols };
  }

  async _writeRoom(room) {
    await this._live;
    await this.sdk.setDoc(this.roomRef, room);
  }

  async _writeDoc(col, id, doc) {
    await this._live;
    const ref = this.sdk.doc(this.roomRef, col, id);
    if (doc) await this.sdk.setDoc(ref, doc);
    else await this.sdk.deleteDoc(ref);
  }

  close() {
    clearTimeout(this._snapTimer);
    for (const u of this.unsubs) u();
    this.unsubs = [];
  }
}
