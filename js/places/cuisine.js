// Place cuisine categories (F3). A place has cuisines: [ids from CUISINES]; older places only have a foods list.
import { CUISINES, expandCuisines } from "../data/cuisines.js";

const order = (set) => CUISINES.filter((c) => set.has(c));

/** Union of the cuisines of the given food ids (foods: Food[] or Map id → Food), in CUISINES order. */
export function cuisinesOfFoods(foodIds, foods) {
  const byId = foods instanceof Map ? foods : new Map(foods.map((f) => [f.id, f]));
  const set = new Set();
  for (const id of foodIds ?? []) for (const c of byId.get(id)?.cuisine ?? []) set.add(c);
  return order(set);
}

/** The place's cuisines: its own when saved, else derived from its food list (the old shape). */
export function placeCuisines(place, foods) {
  if (Array.isArray(place?.cuisines)) return expandCuisines(place.cuisines); // old "asian" reads as its four countries
  return cuisinesOfFoods(place?.foods, foods);
}
