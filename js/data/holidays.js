// Holidays 2026-2029 (Gregorian days of the Hebrew dates, eve included), [from, to] inclusive. Hanukkah 8 days, Purim and Shavuot eve + day.
export const HOLIDAYS = {
  hanukkah: [["2026-12-04", "2026-12-12"], ["2027-12-24", "2028-01-01"], ["2028-12-12", "2028-12-20"], ["2029-11-30", "2029-12-08"]],
  purim: [["2026-03-02", "2026-03-03"], ["2027-03-22", "2027-03-23"], ["2028-03-11", "2028-03-12"], ["2029-02-28", "2029-03-01"]],
  shavuot: [["2026-05-21", "2026-05-22"], ["2027-06-10", "2027-06-11"], ["2028-05-30", "2028-05-31"], ["2029-05-19", "2029-05-20"]],
};
const p = (n) => String(n).padStart(2, "0");

/** "hanukkah" | "purim" | "shavuot" | null for a local day. */
export function holidayOf(d = new Date()) {
  const t = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  return Object.keys(HOLIDAYS).find((k) => HOLIDAYS[k].some(([a, b]) => t >= a && t <= b)) ?? null;
}

/** A heatwave: 32 degrees or more in the cached weather. */
export const heatwave = (w) => w?.temp != null && Number(w.temp) >= 32;

/** Small prior nudge for one food on a holiday or in a heatwave. */
export function seasonBump(f, kind, heat) {
  const h = (t) => f.tags.includes(t);
  let s = 0;
  if (kind === "hanukkah") s = (f.id === "sufganiya" ? 1 : 0) + (h("fried") ? 0.2 : 0) + (h("doughy") && h("sweet") ? 0.2 : 0);
  else if (kind === "purim") s = (h("dessert") ? 0.3 : 0) + (h("sweet") && h("doughy") ? 0.2 : 0);
  else if (kind === "shavuot") s = (h("cheesy") ? 0.4 : 0) + (h("creamy") && !h("junk") ? 0.15 : 0);
  return heat ? s + (h("cold") ? 0.4 : 0) + (h("light") ? 0.3 : 0) - (h("heavy") ? 0.3 : 0) - (h("hot") ? 0.2 : 0) : s;
}
