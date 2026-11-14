// Result mood title (R8): first mood whose tags all appear on the food.
import { STR } from "../data/strings.js";

export function moodFor(food, moods = STR.moods) {
  const m = food && moods.find((m) => m.tags.every((t) => food.tags.includes(t)));
  return m ? m.t : STR.moodDefault;
}
