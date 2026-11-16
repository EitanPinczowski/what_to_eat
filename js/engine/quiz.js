// FoodQuiz — the guessing engine (PLAN.md §5.4, §6; spec-questions.md R1–R12).
import { jaccard } from "./similarity.js";

export const T = 1.3;
export const NOISE_EPS = 0.15; // item 14: chance an answer is random instead of matching her food (the answer model; tuned in tests/sim.js, docs/REVIEW.md)
export const ANSWER_TAU = 1; // answers a food scores higher on are likelier (softmax of the fx deltas / tau); 0 = only the single best answer
const CONFIDENT_P = 0.65; // item 15: the top food this likely ends the quiz (was 0.5: it stopped before telling near-twins apart)
const TWIN = 0.6; // jaccard from which two foods count as near-twins
const MIN_GAIN = 0.03; // nats: below this no step is worth asking, so the quiz guesses
const REPEAT_COST = 0.02; // nats off a question per already-asked question that probes the same tags
const NEAR_BEST = 0.9; // questions within this share of the best gain are picked at random (variety)
const GRID_MIN_N = 3; // the grid and duel may come once the three opening questions are done
const GRID_SHARE = 0.6; // the 9 taps overlap, so their summed gain is discounted
const VETO_RATE = 0.7; // chance she taps a food that is nothing like hers
const RELATED = 0.15; // jaccard from which two foods count as alike
const GRID_SIZE = 9;
const PICK_SIZE = 8;
const MAX_WRONG = 4;
const EXPRESS_AT = 4; // 🦖 starving (item 17): hunger, cuisine, the 2 best questions by information gain, then 3 options
const SHORTLIST_SIZE = 3;
const MAX_DUELS = 1;
export const PICK_BELOW = 0.9; // item 13: at guess time, a top food under this probability ends on 3 options instead of one guess (tuned in tests/sim.js, docs/REVIEW.md)

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function shuffle(arr, rnd) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class FoodQuiz {
  /**
   * @param {object[]} foods  Food[] from buildFoods
   * @param {object[]} questions  QUESTIONS
   * @param {Object<string,number>} prior  id → starting score
   * @param {{rnd?: () => number, shuffle?: boolean}} opts
   */
  constructor(foods, questions, prior = {}, opts = {}) {
    this.foods = foods.map((f) => ({ ...f, set: new Set([...f.tags, ...(f.cuisine ?? []).map((c) => `c:${c}`)]) })); // cuisines are probed as "c:<id>" tags (js/data/cuisines.js)
    this.byId = new Map(this.foods.map((f) => [f.id, f]));
    this.questions = questions;
    this.rnd = opts.rnd ?? Math.random;
    this.learned = opts.learned ?? {};
    this.doShuffle = opts.shuffle ?? true;
    this.pickBelow = opts.pickBelow ?? PICK_BELOW;
    this.pickDistinct = opts.pickDistinct ?? false; // true: shortlist() (not near-twins); false: plain top 3, measured 1-2 points better top-3
    this.starters = questions.filter((q) => q.start).sort((a, b) => a.start - b.start);
    this.s = {
      score: Object.fromEntries(this.foods.map((f) => [f.id, prior[f.id] ?? 0])),
      rejected: [],
      asked: [],
      n: 0,
      duels: 0,
      gridDone: false,
      wrong: 0,
      lastGuessAt: -99,
      big: false, // 🦖 hunger (R11)
      result: null,
    };
    this.trail = [];
    this.stack = [];
    this.eps = NOISE_EPS;
    this.tau = ANSWER_TAU;
    this.minGain = MIN_GAIN;
    this.likCache = new Map();
    this.dimCache = new Map();
    this.memo = new Map(); // state → the step shown there: undo lands on the very same screen (same question order, same duel)
  }

  // ---------- state ----------
  snap() {
    this.stack.push({ s: structuredClone(this.s), trail: [...this.trail] });
  }
  undo() {
    const prev = this.stack.pop();
    if (!prev) return false;
    this.s = prev.s;
    this.trail = prev.trail;
    return true;
  }
  get n() {
    return this.s.n;
  }
  get result() {
    return this.s.result;
  }
  food(id) {
    const f = this.byId.get(id);
    if (!f) return null;
    const { set, ...rest } = f;
    return rest;
  }

  // ---------- probabilities ----------
  live() {
    const rej = new Set(this.s.rejected);
    return this.foods.filter((f) => !rej.has(f.id));
  }
  ranked() {
    const live = this.live();
    if (!live.length) return [];
    const sc = live.map((f) => this.s.score[f.id] / T);
    const max = Math.max(...sc);
    const ex = sc.map((x) => Math.exp(x - max));
    const sum = ex.reduce((a, b) => a + b, 0);
    return live
      .map((f, i) => ({ f: this.food(f.id), p: ex[i] / sum }))
      .sort((a, b) => b.p - a.p);
  }

  delta(f, q, a) {
    const set = f.set ?? new Set(f.tags);
    const w = q.w ?? 1;
    let d = 0;
    for (const [tag, v] of Object.entries(a.fx)) {
      if (!set.has(tag)) continue;
      d += v * w * (this.s.big && tag === "healthy" ? 0.5 : 1);
    }
    const learned = this.learned[`${q.id}:${q.answers.indexOf(a)}`];
    // Learned bonuses only add associations the answer does not already score (no double counting).
    if (learned) for (const [tag, v] of Object.entries(learned)) if (set.has(tag) && !(tag in a.fx)) d += v * w;
    return d;
  }

  // ---------- information gain (item 14) ----------
  /** P(answer | food) for every food × answer of q: (1-ε)·[answer matches the food's tags] + ε·uniform. Cached per question and hunger mode. */
  lik(q) {
    const key = `${q.id}|${this.s.big ? 1 : 0}`;
    let m = this.likCache.get(key);
    if (m) return m;
    const k = q.answers.length;
    m = new Map();
    for (const f of this.foods) {
      const ds = q.answers.map((a) => this.delta(f, q, a));
      const max = Math.max(...ds);
      let w;
      if (this.tau > 0) w = ds.map((d) => Math.exp((d - max) / this.tau));
      else w = ds.map((d) => (d === max ? 1 : 0));
      const sum = w.reduce((a, b) => a + b, 0);
      m.set(f.id, w.map((x) => ((1 - this.eps) * x) / sum + this.eps / k));
    }
    this.likCache.set(key, m);
    return m;
  }

  /** Expected drop in entropy (nats) of the food posterior from asking q. top = [{f, p}] (a posterior; p need not sum to 1). */
  value(q, top) {
    const L = this.lik(q);
    const mass = top.reduce((a, x) => a + x.p, 0);
    if (!(mass > 0)) return 0;
    const rows = top.map((x) => ({ p: x.p / mass, l: L.get(x.f.id) }));
    return this.gain(rows, q.answers.length, (r, o) => r.l[o]) * (q.w ?? 1);
  }

  /** Mutual information between the food and an observation with `k` outcomes, given P(outcome | row) = lik(row, o). */
  gain(rows, k, lik) {
    let h0 = 0;
    for (const r of rows) if (r.p > 0) h0 -= r.p * Math.log(r.p);
    let after = 0;
    for (let o = 0; o < k; o++) {
      let po = 0;
      for (const r of rows) po += r.p * lik(r, o);
      if (po <= 0) continue;
      let h = 0;
      for (const r of rows) {
        const j = (r.p * lik(r, o)) / po;
        if (j > 0) h -= j * Math.log(j);
      }
      after += po * h;
    }
    return h0 - after;
  }

  dims(q) {
    let d = this.dimCache.get(q.id);
    if (!d) this.dimCache.set(q.id, (d = new Set(q.answers.flatMap((a) => Object.keys(a.fx)))));
    return d;
  }

  /** The best unasked question: gain minus a small cost for probing tags already probed; near-ties are picked at random. */
  bestQuestion(ranked) {
    const asked = new Set(this.s.asked);
    const done = this.questions.filter((q) => asked.has(q.id)).map((q) => this.dims(q));
    const scored = this.questions
      .filter((q) => !asked.has(q.id))
      .map((q) => {
        const d = this.dims(q);
        const repeats = done.filter((x) => [...d].some((t) => x.has(t))).length;
        return { q, v: this.value(q, ranked) - REPEAT_COST * repeats };
      })
      .filter((x) => x.v >= MIN_GAIN)
      .sort((a, b) => b.v - a.v);
    if (!scored.length) return null;
    const near = scored.filter((x) => x.v >= NEAR_BEST * scored[0].v);
    // Chosen from the state, not rnd(): reopening the link replays her answers and must land on the same question.
    const pick = near[hashStr(JSON.stringify(this.s)) % near.length];
    return { q: pick.q, v: scored[0].v };
  }

  related(a, b) {
    return a.id === b.id || jaccard(a.set, b.set) >= RELATED;
  }

  /** Gain of the 9-food veto grid: each tap is a yes/no, noisy the same way. */
  gridGain(ranked) {
    const rows = ranked.map((x) => ({ p: x.p, f: this.byId.get(x.f.id) }));
    let sum = 0;
    for (const x of ranked.slice(0, GRID_SIZE)) {
      const item = this.byId.get(x.f.id);
      const pv = (r) => (this.related(item, r.f) ? this.eps / 2 : VETO_RATE * (1 - this.eps) + this.eps / 2);
      sum += this.gain(rows, 2, (r, o) => (o === 1 ? pv(r) : 1 - pv(r)));
    }
    return sum * GRID_SHARE;
  }

  /** The duel pair: the top food against the most different of ranks 2–7. */
  duelPair(ranked) {
    const a = this.byId.get(ranked[0].f.id);
    const pool = ranked.slice(1, 7).map((x) => this.byId.get(x.f.id));
    const b = pool.reduce((m, f) => (jaccard(a.set, f.set) < jaccard(a.set, m.set) ? f : m), pool[0]);
    return [a, b];
  }

  /** Gain of the duel: three outcomes (a, b, neither); a food leans to the side it is more like. */
  duelGain(ranked, a, b) {
    const rows = ranked.map((x) => {
      const f = this.byId.get(x.f.id);
      const sa = f.id === a.id ? 1 : jaccard(f.set, a.set);
      const sb = f.id === b.id ? 1 : jaccard(f.set, b.set);
      const none = Math.max(sa, sb) < RELATED;
      return { p: x.p, w: none ? [0, 0, 1] : sa > sb ? [1, 0, 0] : sb > sa ? [0, 1, 0] : [0.5, 0.5, 0] };
    });
    return this.gain(rows, 3, (r, o) => (1 - this.eps) * r.w[o] + this.eps / 3);
  }

  confident(ranked) {
    const [a, b] = ranked;
    if (!a) return false;
    const p1 = a.p;
    const p2 = b?.p ?? 0;
    const n = this.s.n;
    if (p1 >= CONFIDENT_P || n >= 16) return true;
    const twin = ranked.slice(1, 3).some((x) => jaccard(this.byId.get(a.f.id).set, this.byId.get(x.f.id).set) >= TWIN); // near-twins at the top: keep asking until one of them is clearly ahead
    if (twin && n < 12) return false;
    if (this.s.big) return (n >= 4 && p1 >= 0.2 && p1 >= 1.5 * p2) || n >= 10;
    return n >= 6 && p1 >= 0.25 && p1 >= 1.8 * p2;
  }

  /** 3 hungry-guest options: the top food, then the best ones not too alike (a real choice, not 3 near-twins). */
  shortlist(ranked) {
    const out = [ranked[0]];
    for (const x of ranked.slice(1, 12)) {
      if (out.length >= SHORTLIST_SIZE) break;
      if (out.every((o) => jaccard(this.byId.get(o.f.id).set, this.byId.get(x.f.id).set) < 0.6)) out.push(x);
    }
    for (const x of ranked) if (out.length < SHORTLIST_SIZE && !out.includes(x)) out.push(x);
    return out.map((x) => x.f);
  }

  /** Time to guess: one food when sure, else 3 options she picks from (or none of them, and the quiz goes on). */
  guessStep(ranked) {
    if (ranked[0].p >= this.pickBelow || ranked.length < SHORTLIST_SIZE)
      return { type: "guess", f: ranked[0].f, p: ranked[0].p };
    const items = this.pickDistinct ? this.shortlist(ranked) : ranked.slice(0, SHORTLIST_SIZE).map((x) => x.f);
    return { type: "pick", unsure: true, items };
  }

  qStep(q) {
    const idx = q.answers.map((_, i) => i);
    const order = q.ordered || !this.doShuffle ? idx : shuffle(idx, this.rnd);
    return { type: "q", q, order };
  }

  // ---------- schedule (§6.4) ----------
  next() {
    const key = JSON.stringify(this.s);
    let st = this.memo.get(key);
    if (!st) this.memo.set(key, (st = this.nextStep()));
    return st;
  }
  nextStep() {
    if (this.s.result) return { type: "done", result: this.s.result };
    const ranked = this.ranked();
    if (ranked.length <= 1 && ranked[0]) return { type: "guess", f: ranked[0].f, p: ranked[0].p };
    if (!ranked.length || this.s.wrong >= MAX_WRONG) return { type: "pick", items: ranked.slice(0, PICK_SIZE).map((x) => x.f) };

    const asked = new Set(this.s.asked);
    const starter = this.starters.find((q) => !asked.has(q.id));
    if (starter) return this.qStep(starter);

    const n = this.s.n;
    if (this.s.big && n >= EXPRESS_AT)
      return { type: "pick", express: true, items: ranked.slice(0, SHORTLIST_SIZE).map((x) => x.f) };

    // Every step is scored by expected information gain; the grid and duel only win when they beat the best question.
    const best = this.bestQuestion(ranked);
    const bestV = best?.v ?? 0;
    const canExtra = n >= GRID_MIN_N && ranked.length >= 3;
    const grid = canExtra && !this.s.gridDone ? this.gridGain(ranked) : 0;
    let duel = 0, pair = null;
    if (canExtra && this.s.duels < MAX_DUELS) {
      pair = this.duelPair(ranked);
      duel = this.duelGain(ranked, pair[0], pair[1]);
    }
    const top = Math.max(bestV, grid, duel);
    const guessNow = (this.confident(ranked) || top < this.minGain) && n - this.s.lastGuessAt >= 1;
    if (guessNow) return this.guessStep(ranked);
    if (top < this.minGain) return this.guessStep(ranked);
    if (grid > bestV && grid >= duel) return { type: "grid", items: ranked.slice(0, GRID_SIZE).map((x) => x.f) };
    if (duel > bestV) return { type: "duel", a: this.food(pair[0].id), b: this.food(pair[1].id) };
    return this.qStep(best.q);
  }

  // ---------- answers ----------
  /** answerIndex is the ORIGINAL index into q.answers; -1 = "🤷‍♀️ לא משנה לי" (R5). */
  answer(q, answerIndex) {
    this.snap();
    this.s.asked.push(q.id);
    this.s.n++;
    if (answerIndex < 0) {
      this.trail.push(`${q.text} → 🤷‍♀️`);
      return;
    }
    const a = q.answers[answerIndex];
    if (q.id === "hunger" && answerIndex === 3) this.s.big = true;
    // Soft update: every food is scaled by how likely this answer is for it, so one wrong answer never removes the right food.
    const L = this.lik(q);
    const w = q.w ?? 1;
    for (const f of this.foods) this.s.score[f.id] += T * w * Math.log(L.get(f.id)[answerIndex]);
    this.trail.push(`${q.text} → ${a.e} ${a.t}`);
  }

  spread(src, amount) {
    const s = this.byId.get(src.id);
    for (const f of this.foods) if (f.id !== s.id) this.s.score[f.id] += amount * jaccard(s.set, f.set);
  }

  duel(a, b, choice) {
    this.snap();
    this.s.n++;
    this.s.duels++;
    const sc = this.s.score;
    if (choice === "a" || choice === "b") {
      const [w, l] = choice === "a" ? [a, b] : [b, a];
      sc[w.id] += 2.5;
      sc[l.id] -= 1.5;
      this.spread(w, 1);
      this.trail.push(`${a.name} מול ${b.name} → ${w.name}`);
    } else if (choice === "both") {
      sc[a.id] += 1.5;
      sc[b.id] += 1.5;
      this.trail.push(`${a.name} מול ${b.name} → שניהם`);
    } else {
      sc[a.id] -= 3;
      sc[b.id] -= 3;
      this.spread(a, -1);
      this.spread(b, -1);
      this.trail.push(`${a.name} מול ${b.name} → אף אחד`);
    }
  }

  grid(items, vetoIds = []) {
    this.snap();
    this.s.n++;
    this.s.gridDone = true;
    for (const id of vetoIds) {
      const f = this.byId.get(id);
      if (!f) continue;
      this.s.score[id] -= 6;
      this.spread(f, -0.9);
    }
    const names = vetoIds.map((id) => this.byId.get(id)?.name).filter(Boolean);
    this.trail.push(`ממש לא: ${names.join(", ") || "—"}`);
  }

  guessResult(food, res) {
    this.snap();
    this.s.n++;
    this.s.lastGuessAt = this.s.n;
    if (res === "yes") {
      this.s.result = { f: food.id };
      this.trail.push(`${food.name}? → בול`);
      return;
    }
    this.s.wrong++;
    this.s.rejected.push(food.id);
    this.spread(food, res === "close" ? 1.5 : -2);
    this.trail.push(`${food.name}? → ${res === "close" ? "קרוב" : "לא"}`);
  }

  /** "None of these" on the 3 options: all three are out (like a rejected guess) and the quiz goes on. */
  rejectPick(foods) {
    this.snap();
    this.s.n++;
    this.s.lastGuessAt = this.s.n;
    this.s.wrong++;
    for (const f of foods) {
      this.s.rejected.push(f.id);
      this.s.score[f.id] -= 2;
      this.spread(f, -1);
    }
    this.trail.push(`${foods.map((f) => f.name).join(" / ")}? → אף אחד`);
  }

  /** Finish with a food from the pick list / autocomplete, or free text. */
  choose(foodOrText) {
    this.snap();
    if (typeof foodOrText === "string") {
      const f = this.match(foodOrText);
      this.s.result = f ? { f: f.id } : { free: foodOrText.trim() };
    } else this.s.result = { f: foodOrText.id };
    const r = this.s.result;
    this.trail.push(`בחרה: ${r.f ? this.byId.get(r.f).name : r.free}`);
  }

  /** The one food her typed text means, or null (none fit, or several do: see matchAll). */
  match(text) {
    const fits = this.matchAll(text);
    return fits.length === 1 ? fits[0] : null;
  }

  /**
   * Every food her typed text fits, by whole words (not fragments): a typed word equals a word of the name, with one
   * leading prefix letter (ה ו ב ל כ מ ש) allowed on words of 4+ letters. An exact name wins alone. Either all typed words
   * are words of the name ("פסטה" fits "פסטה ברוזה"), or the whole name is in what she typed ("בא לי פיצה" fits "פיצה").
   */
  matchAll(text) {
    const norm = (s) => s.replace(/[\s״׳"'\-]/g, "").toLowerCase();
    const t = norm(text ?? "");
    if (!t) return [];
    const exact = this.foods.find((f) => norm(f.name) === t || f.id === t);
    if (exact) return [this.food(exact.id)];
    const words = (s) => s.toLowerCase().split(/[\s\-־.,;:!?"'״׳()]+/).filter(Boolean);
    const bare = (w) => (w.length >= 4 && "הובלכמש".includes(w[0]) ? w.slice(1) : w);
    const same = (a, b) => a === b || bare(a) === b || a === bare(b);
    const qw = words(text);
    const inName = [], nameIn = [];
    for (const f of this.foods) {
      const nw = words(f.name);
      if (!nw.length) continue;
      if (qw.every((q) => nw.some((n) => same(q, n)))) inName.push(f);
      else if (norm(f.name).length >= 3 && nw.every((n) => qw.some((q) => same(q, n)))) nameIn.push([f, nw.length]);
    }
    const most = Math.max(0, ...nameIn.map((x) => x[1]));
    const whole = nameIn.filter((x) => x[1] === most).map((x) => x[0]);
    return (whole.length ? whole : inName).map((f) => this.food(f.id));
  }
}
