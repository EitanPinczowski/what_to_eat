// Insights (item 31): pure numbers for the owner's "what did we learn" screen. Nothing is fetched or drawn here.
// Input: history entries, events (js/store/events.js), places by id, foods (buildFoods), questions.
import { FoodQuiz } from "./quiz.js";
import { hitFrom, statsRank } from "./learn.js";
import { monthKey, prevMonth } from "./wrapped.js";

export const MIN_ENTRIES = 3;
export const MIN_ASKED = 5;
export const USELESS_RATE = 0.2;

const pct = (n, d) => (d ? Math.round((n / d) * 100) : null);
const topOf = (counts, n = 5) => Object.entries(counts).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, n);
const tally = (xs) => xs.reduce((m, x) => ((m[x] = (m[x] ?? 0) + 1), m), {});

export function median(xs) {
  const s = xs.filter(Number.isFinite).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** First-guess and top-3 share of the history entries (that carry stats) of one month ("YYYY-MM"); null when none. */
export function accuracyOf(history, month) {
  const hits = (history ?? []).filter((e) => e.stats && monthKey(e.at) === month).map((e) => hitFrom(statsRank(e.stats)));
  return hits.length ? { n: hits.length, first: pct(hits.filter((h) => h.first).length, hits.length), top3: pct(hits.filter((h) => h.top3).length, hits.length) } : null;
}

/** sent -> opened -> finished -> went, counted from events. */
export function funnelOf(events) {
  const c = tally((events ?? []).map((e) => e.k));
  return ["sent", "opened", "finish", "going"].map((k) => ({ k, n: c[k] ?? 0 }));
}

/** Per bucket (weather word or weekday number) of `guess` events: how many, first-guess share, most chosen food id. */
export function guessViewBy(events, field) {
  const by = {};
  for (const e of events ?? []) if (e.k === "guess" && e[field] !== undefined && e[field] !== null) (by[e[field]] ??= []).push(e);
  return Object.entries(by).map(([key, es]) => {
    const first = es.filter((e) => hitFrom(e.r).first).length;
    const [food] = topOf(tally(es.map((e) => e.f).filter(Boolean)), 1)[0] ?? [null];
    return { key, n: es.length, first: pct(first, es.length), food };
  }).sort((a, b) => b.n - a.n || (a.key < b.key ? -1 : 1));
}

export function uselessQuestions(history, foods, questions) {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const asked = {}, changed = {};
  for (const e of history ?? []) {
    if (!Array.isArray(e.ans) || !e.ans.length) continue;
    const z = new FoodQuiz(foods, questions, {}, { rnd: () => 0.5, shuffle: false });
    for (const a of e.ans) {
      const [qid, i] = String(a).split(":");
      const q = byId.get(qid);
      if (!q || !q.answers[+i]) continue;
      const before = z.ranked()[0]?.f.id;
      z.answer(q, +i);
      asked[qid] = (asked[qid] ?? 0) + 1;
      if (z.ranked()[0]?.f.id !== before) changed[qid] = (changed[qid] ?? 0) + 1;
    }
  }
  return Object.keys(asked)
    .filter((id) => asked[id] >= MIN_ASKED && (changed[id] ?? 0) / asked[id] <= USELESS_RATE)
    .map((id) => ({ id, text: byId.get(id).text, asked: asked[id], changed: changed[id] ?? 0, rate: pct(changed[id] ?? 0, asked[id]) }))
    .sort((a, b) => a.rate - b.rate || b.asked - a.asked)
    .slice(0, 5);
}

/** Everything the screen shows. */
export function insightsFor({ history = [], events = [], places = {}, foods = [], questions = [], now = new Date() } = {}) {
  const name = new Map(foods.map((f) => [f.id, f]));
  const dec = events.filter((e) => e.k === "finish" && Number.isFinite(e.t)).map((e) => e.t);
  const view = (field) => guessViewBy(events, field).map((v) => ({ ...v, name: name.get(v.food)?.name ?? null, emoji: name.get(v.food)?.emoji ?? "" }));
  return {
    enough: history.length >= MIN_ENTRIES,
    month: { cur: accuracyOf(history, monthKey(now.toISOString())), prev: accuracyOf(history, prevMonth(now)) },
    funnel: funnelOf(events),
    decision: dec.length ? { n: dec.length, median: Math.round(median(dec)) } : null,
    places: topOf(tally(history.map((e) => e.place).filter((p) => places[p])), 5).map(([id, n]) => ({ id, name: places[id].name, n })),
    rejected: topOf(tally(history.flatMap((e) => e.rej ?? []).filter((id) => name.has(id))), 5).map(([id, n]) => ({ id, name: name.get(id).name, emoji: name.get(id).emoji, n })),
    weather: view("w"),
    weekday: view("d"),
    useless: history.length >= MIN_ENTRIES ? uselessQuestions(history, foods, questions) : [],
  };
}
