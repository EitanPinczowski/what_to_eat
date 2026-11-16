// Item 10: rejoin a room from a pasted link; the room id has a second copy so storage loss never mints a new room.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildQuizLink, buildSweepLink, buildJoinLink, buildResultLink } from "../js/share/links.js";
import { ROOM_KEY, PREV_ROOM_KEY, ownerRoomId } from "../js/store/open.js";
import { roomFromLink, restoreRoom, backupRoom, rejoinFromLink } from "../js/store/room-backup.js";

const mem = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
};
const fakeBackup = (start = null) => {
  const o = { id: start, get: async () => o.id, set: async (v) => void (o.id = v) };
  return o;
};
const ROOM = "abcdefghij0123456789wxyz";

test("roomFromLink: quiz, sweep and join links, bare hash, noisy paste", () => {
  const base = "https://x.github.io/what_to_eat/";
  assert.equal(roomFromLink(buildQuizLink(base, ROOM)), ROOM);
  assert.equal(roomFromLink(buildSweepLink(base, ROOM)), ROOM);
  assert.equal(roomFromLink(buildJoinLink(base, ROOM)), ROOM);
  assert.equal(roomFromLink(`#q=${ROOM}`), ROOM);
  assert.equal(roomFromLink(`  ‏${buildQuizLink(base, ROOM)}\n`), ROOM);
});

test("roomFromLink: result/wrapped links, junk and empty carry no room", () => {
  assert.equal(roomFromLink(buildResultLink("https://x/", { id: "a", t: "quiz" })), null);
  assert.equal(roomFromLink("https://x/#q=ab"), null);
  assert.equal(roomFromLink("hello"), null);
  assert.equal(roomFromLink(""), null);
  assert.equal(roomFromLink(undefined), null);
});

test("restoreRoom: lost localStorage comes back from the backup, no new room is minted", async () => {
  const storage = mem();
  const backup = fakeBackup(ROOM);
  assert.equal(await restoreRoom({ storage, backup }), "restored");
  assert.equal(ownerRoomId(storage), ROOM);
});

test("restoreRoom: nothing anywhere → none (a new room may then be created); existing id is kept", async () => {
  assert.equal(await restoreRoom({ storage: mem(), backup: fakeBackup(null) }), "none");
  assert.equal(await restoreRoom({ storage: mem(), backup: null }), "none");
  assert.equal(await restoreRoom({ storage: mem({ [ROOM_KEY]: "keepkeepkeep1" }), backup: fakeBackup(ROOM) }), "kept");
});

test("restoreRoom: a broken or hanging backup never blocks startup, bad ids are ignored", async () => {
  const broken = { get: async () => { throw new Error("blocked"); }, set: async () => {} };
  assert.equal(await restoreRoom({ storage: mem(), backup: broken }), "none");
  const hang = { get: () => new Promise(() => {}), set: async () => {} };
  assert.equal(await restoreRoom({ storage: mem(), backup: hang, timeout: 20 }), "none");
  assert.equal(await restoreRoom({ storage: mem(), backup: fakeBackup("../x") }), "none");
});

test("backupRoom mirrors the id and survives a failing backup", async () => {
  const backup = fakeBackup();
  await backupRoom({ storage: mem({ [ROOM_KEY]: ROOM }), backup });
  assert.equal(backup.id, ROOM);
  await backupRoom({ storage: mem({ [ROOM_KEY]: ROOM }), backup: { get: async () => { throw new Error("x"); }, set: async () => { throw new Error("x"); } } });
  await backupRoom({ storage: mem(), backup });
  assert.equal(backup.id, ROOM);
});

test("rejoinFromLink: bad / same / declined / new / adopted, keeps the old id, updates the backup", async () => {
  const link = buildQuizLink("https://x/", ROOM);
  assert.equal(await rejoinFromLink("nope", { storage: mem(), backup: fakeBackup() }), "bad");
  assert.equal(await rejoinFromLink(link, { storage: mem({ [ROOM_KEY]: ROOM }), backup: fakeBackup() }), "same");

  const s1 = mem({ [ROOM_KEY]: "oldoldoldold1" });
  const b1 = fakeBackup("oldoldoldold1");
  assert.equal(await rejoinFromLink(link, { storage: s1, ask: () => false, backup: b1 }), "declined");
  assert.equal(s1.getItem(ROOM_KEY), "oldoldoldold1");
  assert.equal(b1.id, "oldoldoldold1");

  assert.equal(await rejoinFromLink(link, { storage: s1, ask: () => true, backup: b1 }), "adopted");
  assert.equal(s1.getItem(ROOM_KEY), ROOM);
  assert.equal(s1.getItem(PREV_ROOM_KEY), "oldoldoldold1");
  assert.equal(b1.id, ROOM);

  const s2 = mem();
  const b2 = fakeBackup();
  assert.equal(await rejoinFromLink(link, { storage: s2, backup: b2 }), "new");
  assert.equal(b2.id, ROOM);
});
