// Room id recovery (item 10). Loaded on demand (main.js, Settings), so it stays out of the start-up graph.
import { ROOM_KEY, adoptRoom } from "./open.js";
import { parseHash } from "../share/links.js";

/**
 * The room id inside any app link that carries one: #q= (quiz), #s= (sweep), #join= (device link).
 * Accepts the whole link, only its #… part, or surrounding text. Returns null when there is none (#r= / #w= carry no room).
 */
export function roomFromLink(text) {
  const t = String(text ?? "").replace(/[‎‏‪-‮⁦-⁩﻿\s]/g, "");
  const i = t.indexOf("#");
  if (i < 0) return null;
  const r = parseHash(t.slice(i));
  return r.room && ["q", "s", "join"].includes(r.kind) ? r.room : null;
}

const DB_NAME = "mabalach_backup";

/** IndexedDB key-value backup; null where IndexedDB is missing (private mode, tests in Node). */
export function idbBackup(idb = globalThis.indexedDB) {
  if (!idb) return null;
  const open = () =>
    new Promise((res, rej) => {
      const rq = idb.open(DB_NAME, 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore("kv");
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    });
  const tx = async (mode, fn) => {
    const db = await open();
    try {
      return await new Promise((res, rej) => {
        const rq = fn(db.transaction("kv", mode).objectStore("kv"));
        rq.onsuccess = () => res(rq.result);
        rq.onerror = () => rej(rq.error);
      });
    } finally {
      db.close();
    }
  };
  return { get: async () => (await tx("readonly", (s) => s.get(ROOM_KEY))) ?? null, set: async (id) => void (await tx("readwrite", (s) => s.put(id, ROOM_KEY))) };
}

const within = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(rej, ms, new Error("timeout")))]);
const ROOM_OK = /^[a-z0-9]{6,40}$/;

/**
 * Before anything reads or creates the room id: if this device lost it (localStorage empty) but the backup has it, put it back.
 * Returns "kept" (already there) | "restored" | "none" (nothing anywhere: a new room may be created).
 */
export async function restoreRoom({ storage = globalThis.localStorage, backup = idbBackup(), timeout = 1500 } = {}) {
  if (storage?.getItem(ROOM_KEY)) return "kept";
  try {
    const id = backup && (await within(backup.get(), timeout));
    if (typeof id === "string" && ROOM_OK.test(id)) {
      storage?.setItem(ROOM_KEY, id);
      return "restored";
    }
  } catch {
    // harmless: backup unreadable (private mode / blocked) — behaves as if there were none
  }
  return "none";
}

/** Mirror the current room id into the backup (best effort, never throws). */
export async function backupRoom({ storage = globalThis.localStorage, backup = idbBackup(), timeout = 1500 } = {}) {
  try {
    const id = storage?.getItem(ROOM_KEY);
    if (id && backup && (await within(backup.get(), timeout).catch(() => null)) !== id) await within(backup.set(id), timeout);
  } catch {
    // harmless: the backup is a second chance, not the source of truth
  }
}

/**
 * Settings: a pasted app link (#q= / #s= / #join=) rejoins that room. Same confirm / keep-old-id rules as adoptRoom.
 * Returns "bad" | "same" | "declined" | "new" | "adopted".
 */
export async function rejoinFromLink(text, { storage = globalThis.localStorage, ask = () => true, backup = idbBackup() } = {}) {
  const room = roomFromLink(text);
  if (!room) return "bad";
  const res = adoptRoom(room, { storage, ask });
  if (res === "new" || res === "adopted") await backupRoom({ storage, backup });
  return res;
}
