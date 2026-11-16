// FoodQuiz — the guessing engine (PLAN.md §5.4, §6; spec-questions.md R1–R12).
import { jaccard } from "./similarity.js";

export const T = 1.3;
export const NOISE_EPS = 0.15;
export const ANSWER_TAU = 1;
const CONFIDENT_P = 0.65;
const TWIN = 0.6;
const MIN_GAIN = 0.03;
const REPEAT_COST = 0.02;
const NEAR_BEST = 0.9;
const GRID_MIN_N = 3;
const GRID_SHARE = 0.6;
const VETO_RATE = 0.7;
const RELATED = 0.15;
const GRID_SIZE = 9;
const PICK_SIZE = 8;
const MAX_WRONG = 4;
export const MAX_Q = 7;
const EXPRESS_Q = 3;
const QUOTA = 2;
const KNOWN_W = 0.5;
const PAIR_W = 0.6;
const NEED_MASS = 0.3;
const FEEL = ["bite", "warmth", "after"];
const SHORTLIST_SIZE = 3;
const MAX_DUELS = 1;
/** Interpolate two effect maps: t = 0 is a, t = 1 is b. */
export function lerpFx(a, b, t) {
  const out = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const v = Math.round(((1 - t) * (a[k] ?? 0) + t * (b[k] ?? 0)) * 100) / 100;
    if (v) out[k] = v;
  }
  return out;
}
/** The bucket (0..n-1) of a slider position t in [0,1]; a slider counts as n buckets for information gain, undo and resume. */
export const bucketOf = (q, t) => Math.round(Math.min(1, Math.max(0, t)) * (q.answers.length - 1));
export const PICK_BELOW = 0.9;

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
  constructor(foods, questions, prior = {}, opts = {}) {
    this.foods = foods.map((f) => ({ ...f, set: new Set([...f.tags, ...(f.cuisine ?? []).map((c) => `c:${c}`)]) }));
    this.byId = new Map(this.foods.map((f) => [f.id, f]));
    this.questions = questions;
    this.rnd = opts.rnd ?? Math.random;
    this.learned = opts.learned ?? {};
    this.doShuffle = opts.shuffle ?? true;
    this.pickBelow = opts.pickBelow ?? PICK_BELOW;
    this.pickDistinct = opts.pickDistinct ?? false;
    this.qById = new Map(questions.map((q) => [q.id, q]));
    this.seen = opts.seen ?? [];
    this.salt = opts.salt ?? "";
    this.novel = opts.novel ?? {};
    this.known = {};
    this.s = {
      score: Object.fromEntries(this.foods.map((f) => [f.id, prior[f.id] ?? 0])),
      rejected: [],
      asked: [],
      n: 0,
      duels: 0,
      gut: false,
      excl: [],
      refineAt: -1,
      gridDone: false,
      wrong: 0,
      lastGuessAt: -99,
      big: false,
      result: null,
    };
    this.trail = [];
    this.stack = [];
    this.eps = NOISE_EPS;
    this.tau = ANSWER_TAU;
    this.minGain = MIN_GAIN;
    this.likCache = new Map();
    this.dimCache = new Map();
    this.memo = new Map();
    for (const [axis, k] of Object.entries(opts.known ?? {})) {
      const q = questions.find((x) => x.axis === axis && x.answers.some((a) => a.k === k));
      if (!q) continue;
      const i = q.answers.findIndex((a) => a.k === k);
      this.known[axis] = { q: q.id, i, k };
      this.soft(q, i, KNOWN_W);
    }
  }

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
    if (a.dyn) for (const [k, v] of Object.entries(a.dyn)) d += v * w * (this.novel[k]?.[f.id] ?? 0);
    const learned = this.learned[`${q.id}:${q.answers.indexOf(a)}`];
    if (learned) for (const [tag, v] of Object.entries(learned)) if (set.has(tag) && !(tag in a.fx)) d += v * w;
    return d;
  }

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

  /** The variant of an axis to ask: not one she saw in her last quizzes (the longest ago wins), then by a hash of the answers so far; the first question always has 3 buttons. */
  variant(axis) {
    const asked = this.s.asked;
    let vs = this.questions.filter((q) => q.axis === axis);
    if (!asked.length && vs.some((q) => !q.slider && q.answers.length === 3)) vs = vs.filter((q) => !q.slider && q.answers.length === 3);
    const age = (q) => {
      const i = this.seen.findIndex((ids) => ids.includes(q.id));
      return i < 0 ? 99 : i;
    };
    const far = Math.max(...vs.map(age));
    vs = vs.filter((q) => age(q) === far);
    return vs[hashStr(`${axis}|${asked.join(",")}|${this.salt}`) % vs.length];
  }

  axisStage(axis) {
    return this.questions.find((q) => q.axis === axis)?.stage;
  }

  /** Is this question's subject in play: a share of the posterior carries one of its `need` tags. */
  inPlay(q, ranked) {
    if (!q.need) return true;
    return ranked.reduce((m, x) => m + (q.need.some((t) => this.byId.get(x.f.id).set.has(t)) ? x.p : 0), 0) >= NEED_MASS;
  }

  /** The best question of these axes (unasked, not known): gain minus a small cost for probing tags already probed; near-ties by a hash of the state. */
  bestOf(axes, ranked, minGain = MIN_GAIN) {
    const asked = new Set(this.s.asked);
    const done = this.questions.filter((q) => asked.has(q.id)).map((q) => this.dims(q));
    const scored = axes
      .map((axis) => this.variant(axis))
      .filter((q) => q && this.inPlay(q, ranked))
      .map((q) => {
        const d = this.dims(q);
        const repeats = done.filter((x) => [...d].some((t) => x.has(t))).length;
        return { q, v: this.value(q, ranked) - REPEAT_COST * repeats };
      })
      .filter((x) => x.v >= minGain)
      .sort((a, b) => b.v - a.v);
    if (!scored.length) return null;
    const near = scored.filter((x) => x.v >= NEAR_BEST * scored[0].v);
    const pick = near[hashStr(JSON.stringify(this.s)) % near.length];
    return { q: pick.q, v: scored[0].v };
  }

  /** The next question, stage by stage (body, mood, craving, feel; two per stage), or null when nothing is worth asking. */
  bestQuestion(ranked) {
    const asked = this.s.asked;
    if (asked.length >= MAX_Q) return null;
    if (!asked.length) return { q: this.variant("hunger"), v: 1 };
    const done = new Set(asked.map((id) => this.qById.get(id)?.axis));
    const axes = [...new Set(this.questions.map((q) => q.axis))].filter((a) => !done.has(a) && !this.known[a]);
    if (this.s.big) {
      if (asked.length >= EXPRESS_Q) return null;
      const want = asked.length === 1 ? axes.filter((a) => this.axisStage(a) === 2) : axes.filter((a) => FEEL.includes(a));
      return this.bestOf(want, ranked, -1);
    }
    const top = Math.max(1, ...asked.map((id) => this.qById.get(id)?.stage ?? 1));
    for (let st = top; st <= 4; st++) {
      if ([...done].filter((a) => this.axisStage(a) === st).length >= QUOTA) continue;
      const best = this.bestOf(axes.filter((a) => this.axisStage(a) === st), ranked);
      if (best) return best;
    }
    return null;
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
    const twin = ranked.slice(1, 3).some((x) => jaccard(this.byId.get(a.f.id).set, this.byId.get(x.f.id).set) >= TWIN);
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
  guessStep(all) {
    const fresh = all.filter((x) => !this.s.excl.includes(x.f.id)); // "Close, but…" never offers the foods she was already shown
    const ranked = fresh.length >= SHORTLIST_SIZE ? fresh : all;
    if (ranked[0].p >= this.pickBelow || ranked.length < SHORTLIST_SIZE)
      return { type: "guess", f: ranked[0].f, p: ranked[0].p };
    const gut = this.gutPair(ranked);
    if (gut) return { type: "gut", a: this.food(gut[0].id), b: this.food(gut[1].id) };
    const items = this.pickDistinct ? this.shortlist(ranked) : ranked.slice(0, SHORTLIST_SIZE).map((x) => x.f);
    return { type: "pick", unsure: true, items };
  }

  /** The gut-check pair: once per quiz, when the top 2 are near-twins (the same TWIN rule as confident()), before the options. null otherwise. */
  gutPair(ranked) {
    const [a, b] = ranked.map((x) => this.byId.get(x.f.id));
    return !this.s.gut && !this.s.excl.length && b && jaccard(a.set, b.set) >= TWIN ? [a, b] : null;
  }

  qStep(q) {
    const idx = q.answers.map((_, i) => i);
    const order = q.ordered || !this.doShuffle ? idx : shuffle(idx, this.rnd);
    return { type: "q", q, order };
  }

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

    const n = this.s.n;
    const nq = this.s.asked.length;
    if (this.s.refineAt === n) return this.guessStep(ranked); // right after "Close, but…": 3 new options now
    if (this.s.big && nq >= EXPRESS_Q)
      return { type: "pick", express: true, items: ranked.slice(0, SHORTLIST_SIZE).map((x) => x.f) };
    if (nq >= MAX_Q) return this.guessStep(ranked);
    if (!nq) return this.qStep(this.bestQuestion(ranked).q);

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

  /** Soft update: foods are scaled by how likely answer i is for them, so one wrong answer removes nothing. m = weight (a pair counts 0.6 each). */
  soft(q, i, m = 1) {
    const L = this.lik(q);
    const w = (q.w ?? 1) * m;
    for (const f of this.foods) this.s.score[f.id] += T * w * Math.log(L.get(f.id)[i]);
  }

  /** answerIndex is the ORIGINAL index into q.answers (a slider's bucket); [i, j] = two answers (0.6× each); -1 = "🤷‍♀️ לא משנה לי" (R5, never offered to her). */
  answer(q, answerIndex) {
    this.snap();
    this.s.asked.push(q.id);
    this.s.n++;
    const idx = Array.isArray(answerIndex) ? answerIndex : [answerIndex];
    if (idx[0] < 0) {
      this.trail.push(`${q.text} → 🤷‍♀️`);
      return;
    }
    const as = idx.map((i) => q.answers[i]);
    if (as.some((a) => a.big)) this.s.big = true;
    for (const i of idx) this.soft(q, i, idx.length > 1 ? PAIR_W : 1);
    this.trail.push(`${q.text} → ${as.map((a) => `${a.e} ${a.t}`).join(" + ")}`);
  }

  /** A slider answered by position t in [0,1]: it lands on the nearest of its buckets. */
  answerAt(q, t) {
    this.answer(q, bucketOf(q, t));
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

  /** Gut-check: her tap on the picture she craves more is a strong answer (not a question: MAX_Q does not count it). */
  gut(a, b, choice) {
    this.snap();
    this.s.n++;
    this.s.gut = true;
    const [w, l] = choice === "a" ? [a, b] : [b, a];
    this.s.score[w.id] += 2;
    this.s.score[l.id] -= 1;
    this.trail.push(`${a.name} או ${b.name} → ${w.name}`);
  }

  /** "Close, but…": fx (tag → weight) nudges every food that has the tag; `shown` (the options she just saw) are never offered again. */
  refine(fx, shown, label = "") {
    this.snap();
    this.s.n++;
    this.s.refineAt = this.s.n;
    this.s.excl.push(...shown.filter((id) => !this.s.excl.includes(id)));
    for (const f of this.foods) for (const [tag, v] of Object.entries(fx)) if (f.set.has(tag)) this.s.score[f.id] += v;
    this.trail.push(`קרוב, אבל ${label}`);
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

/** Countdown under the question: questions probably left, at least 1 while one is on screen. Pure. */
export function questionsLeft(asked, p1, max = MAX_Q) {
  const room = Math.max(1, max - asked);
  const want = p1 >= 0.6 ? 1 : p1 >= 0.4 ? 2 : p1 >= 0.25 ? 3 : room;
  return Math.max(1, Math.min(room, want));
}
