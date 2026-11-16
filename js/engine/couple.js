// Couple mode (1e): Eitan's answers to a few feeling questions nudge the result. His answers are stored as "qid:i" strings.
// Her answers count 1 each, so his count HIS_W = 0.5: she weighs 2x, he 1x. Applied once, before any of her actions replay, so a resumed quiz scores the same.
export const HIS_QS = ["mood1", "family1", "after1"];
export const HIS_W = 0.5;

/** "mood1:2" -> [qid, 2]; anything malformed or outside the three questions is dropped (at most one answer per question). */
export function parseHis(his) {
  const seen = new Set(), out = [];
  for (const s of Array.isArray(his) ? his : []) {
    const [q, n] = String(s).split(":");
    const i = Number(n);
    if (HIS_QS.includes(q) && Number.isInteger(i) && i >= 0 && !seen.has(q)) (seen.add(q), out.push([q, i]));
  }
  return out;
}

/** Folds his answers into the engine's scores at half her weight. They do not count as asked questions. */
export function applyHis(z, his) {
  for (const [qid, i] of parseHis(his)) {
    const q = z.qById.get(qid);
    if (q && q.answers[i]) z.soft(q, i, HIS_W);
  }
  return z;
}

/** [[label, value], ...] for the result screen and the card: his own wording, empty when nothing valid. */
export function hisChips(his, COUPLE) {
  return parseHis(his).flatMap(([q, i]) => {
    const a = COUPLE.qs[q]?.a[i];
    return a ? [[COUPLE.qs[q].t, `${a[0]} ${a[1]}`]] : [];
  });
}
