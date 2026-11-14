// FoodQuiz — the guessing engine (PLAN.md §5.4, §6; spec-questions.md R1–R12).
import { jaccard } from "./similarity.js";

export const T = 1.6;
const TOP_K = 14;
const MIN_VALUE = 0.15;
const GRID_AT = 5;
const GRID_SIZE = 9;
const PICK_SIZE = 8;
const MAX_WRONG = 4;
const MAX_DUELS = 3;
const NEED_MASS = 0.15;

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
    this.foods = foods.map((f) => ({ ...f, set: new Set(f.tags) }));
    this.byId = new Map(this.foods.map((f) => [f.id, f]));
    this.questions = questions;
    this.rnd = opts.rnd ?? Math.random;
    this.doShuffle = opts.shuffle ?? true;
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
    return d;
  }

  // value(q) = mean over answers of Var_P(delta) over the top-K, renormalised
  value(q, top) {
    const mass = top.reduce((a, x) => a + x.p, 0);
    if (q.need) {
      const m = top.filter((x) => q.need.some((t) => x.f.tags.includes(t))).reduce((a, x) => a + x.p, 0);
      if (m / mass < NEED_MASS) return 0;
    }
    let total = 0;
    for (const a of q.answers) {
      let mean = 0;
      let sq = 0;
      for (const x of top) {
        const d = this.delta(this.byId.get(x.f.id), q, a);
        const p = x.p / mass;
        mean += p * d;
        sq += p * d * d;
      }
      total += sq - mean * mean;
    }
    return total / q.answers.length;
  }

  bestQuestion(ranked) {
    const top = ranked.slice(0, TOP_K);
    const asked = new Set(this.s.asked);
    const scored = this.questions
      .filter((q) => !asked.has(q.id))
      .map((q) => ({ q, v: this.value(q, top) }))
      .filter((x) => x.v >= MIN_VALUE)
      .sort((a, b) => b.v - a.v);
    if (!scored.length) return null;
    const near = scored.filter((x) => x.v >= 0.85 * scored[0].v);
    return near[Math.floor(this.rnd() * near.length)].q;
  }

  confident(ranked) {
    const [a, b] = ranked;
    if (!a) return false;
    const p1 = a.p;
    const p2 = b?.p ?? 0;
    const n = this.s.n;
    if (p1 >= 0.5 || n >= 16) return true;
    if (this.s.big) return (n >= 4 && p1 >= 0.2 && p1 >= 1.5 * p2) || n >= 10;
    return n >= 6 && p1 >= 0.25 && p1 >= 1.8 * p2;
  }

  qStep(q) {
    const idx = q.answers.map((_, i) => i);
    const order = q.ordered || !this.doShuffle ? idx : shuffle(idx, this.rnd);
    return { type: "q", q, order };
  }

  // ---------- schedule (§6.4) ----------
  next() {
    if (this.s.result) return { type: "done", result: this.s.result };
    const ranked = this.ranked();
    if (ranked.length <= 1 && ranked[0]) return { type: "guess", f: ranked[0].f, p: ranked[0].p };
    if (!ranked.length || this.s.wrong >= MAX_WRONG) return { type: "pick", items: ranked.slice(0, PICK_SIZE).map((x) => x.f) };

    const asked = new Set(this.s.asked);
    const starter = this.starters.find((q) => !asked.has(q.id));
    if (starter) return this.qStep(starter);

    const n = this.s.n;
    if (n >= GRID_AT && !this.s.gridDone) return { type: "grid", items: ranked.slice(0, GRID_SIZE).map((x) => x.f) };

    const best = this.bestQuestion(ranked);
    if ((this.confident(ranked) || !best) && n - this.s.lastGuessAt >= 2)
      return { type: "guess", f: ranked[0].f, p: ranked[0].p };

    if (n % 4 === 3 && this.s.duels < MAX_DUELS && ranked.length >= 3) {
      const a = this.byId.get(ranked[0].f.id);
      const pool = ranked.slice(1, 7).map((x) => this.byId.get(x.f.id));
      const b = pool.reduce((m, f) => (jaccard(a.set, f.set) < jaccard(a.set, m.set) ? f : m), pool[0]);
      return { type: "duel", a: this.food(a.id), b: this.food(b.id) };
    }
    if (best) return this.qStep(best);
    return { type: "guess", f: ranked[0].f, p: ranked[0].p };
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
    for (const f of this.foods) this.s.score[f.id] += this.delta(f, q, a);
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

  match(text) {
    const norm = (s) => s.replace(/[\s״׳"'\-]/g, "").toLowerCase();
    const t = norm(text ?? "");
    if (!t) return null;
    const exact = this.foods.find((f) => norm(f.name) === t || f.id === t);
    const f = exact ?? this.foods.find((f) => norm(f.name).includes(t) || (t.length >= 3 && t.includes(norm(f.name))));
    return f ? this.food(f.id) : null;
  }
}
