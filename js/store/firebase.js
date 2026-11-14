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
  constructor(roomId, config, { sdk } = {}) {
    super(roomId);
    this.config = config;
    this.sdk = sdk;
    this.unsubs = [];
  }

  async _open() {
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

    const snap = await s.getDoc(this.roomRef);
    const cols = {};
    for (const c of COLLECTIONS) {
      cols[c] = {};
      const qs = await s.getDocs(s.collection(this.roomRef, c));
      qs.forEach((d) => (cols[c][d.id] = d.data()));
    }

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
        }),
      );
    return { room: snap.exists() ? snap.data() : null, cols };
  }

  async _writeRoom(room) {
    await this.sdk.setDoc(this.roomRef, room);
  }

  async _writeDoc(col, id, doc) {
    const ref = this.sdk.doc(this.roomRef, col, id);
    if (doc) await this.sdk.setDoc(ref, doc);
    else await this.sdk.deleteDoc(ref);
  }

  close() {
    for (const u of this.unsubs) u();
    this.unsubs = [];
  }
}
