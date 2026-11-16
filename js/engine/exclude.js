// "Never for me" (W4a): one pure helper, used by the quiz foods (so the result, the 3 options and the refine never see an excluded food),
// the picker's suggestions and the profile screen. An entry is an ingredient key (food.has, e.g. "pepper") or a food id.
export const NEVER_MAX = 30;
export const NEVER_DEFAULT = ["pepper"];
const ENTRY_LEN = 40;

/** A clean list: trimmed short strings, no duplicates, at most NEVER_MAX. Anything else gives []. */
export function cleanList(list, max = NEVER_MAX) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const x of list) {
    const s = typeof x === "string" ? x.trim().slice(0, ENTRY_LEN) : "";
    if (s && !out.includes(s)) out.push(s);
  }
  return out.slice(0, max);
}

/** True when the food is on her never list (by its id or by an ingredient it has). */
export function isExcluded(food, never) {
  const n = never ?? [];
  if (!food || !n.length) return false;
  return n.includes(food.id) || (food.has ?? []).some((h) => n.includes(h));
}

/** The foods she may be offered. Returns the same array when nothing is excluded. */
export function allowedFoods(foods, never) {
  return never?.length ? foods.filter((f) => !isExcluded(f, never)) : foods;
}

/** Prior boost for hearted foods: small, so a fit decides and a heart only tips it. */
export const FAV_BOOST = 0.7;
export const favBoosts = (fav) => Object.fromEntries(cleanList(fav).map((id) => [id, FAV_BOOST]));

/** Toggle one entry in a list (returns a new clean list; a full list refuses to grow). */
export function toggle(list, id) {
  const l = cleanList(list);
  return l.includes(id) ? l.filter((x) => x !== id) : cleanList([...l, id]);
}
