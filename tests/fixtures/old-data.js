// Saved data as older versions of the app wrote it (item 33d). Shapes are partial on purpose: fields added later
// (v, exp, learned, imported, cuisines, wantTry, stats.guesses, rej, ib, sentAt, push, dead, events) are missing.
const AT = (d) => new Date(Date.now() - d * 864e5).toISOString();

/** The room doc of the very first versions: no schema number, no learned/exp/imported, a legacy key. */
export const OLD_ROOM_V0 = { settings: { her: "נגה", me: "איתן" }, ratings: { sushi: { r: 4 }, pizza: { r: 3 } }, custom: [], inbox: [], favs: ["pizza"] };

/** A bare minimum, an empty object and null all have to load. */
export const OLD_ROOMS = [OLD_ROOM_V0, {}, null, { v: 0 }, { v: 1, settings: { her: "נגה" } }, { settings: null }];

export const OLD_HISTORY = () => ({
  // first-era entry: no trail, no stats, no price
  a1: { f: "pizza", fn: "פיצה", fe: "🍕", at: AT(40), m: "take" },
  // free text she typed (no food id)
  a2: { f: null, fn: "מרק של סבתא", fe: "🍽️", at: AT(30), m: "home" },
  // stats without guesses (item 30), no top / rej / ib
  a3: { f: "sushi", fn: "סושי", fe: "🍣", at: AT(10), m: "delivery", price: 3, trail: ["רעב?"], stats: { hit: true, steps: 7 } },
  // old "how was it" number, place by name only
  a4: { f: "falafel", fn: "פלאפל", fe: "🧆", at: AT(3), m: "take", how: 1, place: "הפלאפל של יוסי", goAt: AT(3) },
  // an entry whose food no longer exists in the catalogue
  a5: { f: "removed_food_xyz", fn: "משהו ישן", fe: "❓", at: AT(2), m: "sit", stats: { hit: false, guesses: 2, steps: 9 } },
  // a doc with nothing but a time
  a6: { at: AT(1) },
});

export const OLD_PLACES = () => ({
  // places before cuisines and wantTry: only a foods list
  p1: { name: "פיצה של רפי", city: "רעננה", modes: ["take", "delivery"], foods: ["pizza"], price: 2, rating: 4 },
  p2: { name: "בלי כלום" },
  p3: { name: "סושי בר", modes: ["sit"], foods: ["sushi", "removed_food_xyz"], link: "", hours: [], visits: [] },
});

export const OLD_LIVE = () => ({
  // live/quiz of the first version: no sentAt, no push, no dead, no actions
  quiz: { mode: "take", n: 3, i: 3, finished: true, f: "pizza", opened: AT(0.1), at: AT(0.05) },
  // a vote written before names were stored
  vote: { o: ["p1", "p3"], at: AT(0.2) },
});

/** Tombstones left by "rotate key" in the two log collections, and logs of the first versions. */
export const OLD_LOGS = () => ({
  errors: { e1: { moved: true, at: AT(5) }, e2: { at: AT(4), msg: "old error" } },
  feedback: { f1: { moved: true, at: AT(5) }, f2: { at: AT(6), text: "אפשר גם כפתור?" } },
});

/** A whole localStorage record for the LocalStore: {room, cols}. */
export function oldLocalRecord(room = OLD_ROOM_V0) {
  return { room, cols: { history: OLD_HISTORY(), places: OLD_PLACES(), live: OLD_LIVE(), shopping: { s1: { text: "חלב", done: false } }, ...OLD_LOGS() } };
}
