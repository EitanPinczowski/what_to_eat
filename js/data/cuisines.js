// Food types (R1c-1). A food's first cuisine is its main one. sweet/snack are kinds, kept for places.
export const FOOD_CUISINES = ["israeli", "middle", "italian", "mexican", "american", "japanese", "thai", "chinese", "indian", "cafe"];
export const KINDS = ["sweet", "snack"];
export const CUISINES = [...FOOD_CUISINES, ...KINDS];
export const LEGACY = { asian: ["japanese", "thai", "chinese", "indian"] }; // old place ids, read as the new ones
export const expandCuisines = (list) => {
  const set = new Set((list ?? []).flatMap((c) => LEGACY[c] ?? [c]));
  return CUISINES.filter((c) => set.has(c));
};
export const mainCuisine = (food) => (food?.cuisine ?? []).find((c) => FOOD_CUISINES.includes(c)) ?? null;
