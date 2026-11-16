// Pure helpers for the photo picker (photos.html) and tools/apply-picks.mjs.
// picks.json: { foodId: "File:Title.jpg" | "emoji" }. A food with no entry is untouched (keeps whatever it has).

export function loadPicks(store, key) {
  try {
    const v = JSON.parse(store?.getItem(key) ?? "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

export function savePicks(store, key, picks) {
  try { store?.setItem(key, JSON.stringify(picks)); } catch {}
}

/** Tapping the chosen option again un-picks it. Returns a new object. */
export function setPick(picks, id, value) {
  const next = { ...picks };
  if (next[id] === value) delete next[id];
  else next[id] = value;
  return next;
}

/** picks.json text; picks whose title is not among that food's candidates are dropped. */
export function exportPicks(picks, cands) {
  const out = {};
  for (const id of Object.keys(picks).sort()) {
    const v = picks[id];
    if (v === "emoji" || (cands[id] ?? []).some((c) => c.title === v)) out[id] = v;
  }
  return JSON.stringify(out, null, 1) + "\n";
}

/** Validate a picks.json object against the candidates; returns { ok: [[id,title,cand]], emoji: [id], bad: [id] }. */
export function readPicks(picks, cands, foodIds) {
  const res = { ok: [], emoji: [], bad: [] };
  for (const [id, v] of Object.entries(picks)) {
    const cand = (cands[id] ?? []).find((c) => c.title === v);
    if (!foodIds.has(id)) res.bad.push(id);
    else if (v === "emoji") res.emoji.push(id);
    else if (cand) res.ok.push([id, v, cand]);
    else res.bad.push(id);
  }
  return res;
}
