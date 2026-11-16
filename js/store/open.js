// Pick a Store: ?store=local (e2e) or no Firebase config → LocalStore; otherwise FirebaseStore.
import { LocalStore } from "./local.js";
import { newId } from "../share/codec.js";

export const ROOM_KEY = "mabalach_room";

/** The owner's room id, created on first run (24 chars ≈ 120 bits). */
export function ownerRoomId(storage = globalThis.localStorage) {
  let id = storage?.getItem(ROOM_KEY);
  if (!id) {
    id = newId(24, () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32);
    storage?.setItem(ROOM_KEY, id);
  }
  return id;
}

/** fast: open from this device's saved copy of the room (owner screens only; never for her quiz, which must see live state). */
export async function openStore(roomId, { mode, fast = false } = {}) {
  let config = null;
  if (mode !== "local") {
    try {
      config = (await import("../firebase-config.js")).firebaseConfig;
    } catch {
      config = null;
    }
  }
  if (!config) return new LocalStore(roomId).ready();
  const { FirebaseStore } = await import("./firebase.js");
  return new FirebaseStore(roomId, config, { fast }).ready();
}

export const PREV_ROOM_KEY = "mabalach_prev_room";

/**
 * Another device's join link. Never silently replaces a different stored room: asks first (ask() -> bool)
 * and keeps the replaced id under PREV_ROOM_KEY so it can be recovered.
 * Returns "same" | "new" | "adopted" | "declined".
 */
export function adoptRoom(id, { storage = globalThis.localStorage, ask = () => true } = {}) {
  const cur = storage?.getItem(ROOM_KEY);
  if (cur === id) return "same";
  if (!cur) {
    storage?.setItem(ROOM_KEY, id);
    return "new";
  }
  if (!ask()) return "declined";
  storage.setItem(PREV_ROOM_KEY, cur);
  storage.setItem(ROOM_KEY, id);
  return "adopted";
}
