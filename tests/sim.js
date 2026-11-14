// Accuracy simulation for the guessing engine (PLAN.md §6.5).
// A simulated guest answers consistently with a hidden target food, with 15% noise.
// Usage: node tests/sim.js [trials-per-food=5] [--verbose]
import { FOODS } from "../js/data/foods.js";
import { QUESTIONS } from "../js/data/questions.js";
import { buildFoods } from "../js/engine/foods.js";
import { jaccard } from "../js/engine/similarity.js";
import { FoodQuiz } from "../js/engine/quiz.js";
import { learnFrom } from "../js/engine/learn.js";

const TRIALS = Number(process.argv[2]) || 5;
const VERBOSE = process.argv.includes("--verbose");
const NOISE = 0.15;
const TARGETS = { exact: 0.75, found: 0.95, steps: 10 };

const foods = buildFoods(FOODS);
const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function play(target, rnd, learned = {}) {
  const z = new FoodQuiz(foods, QUESTIONS, {}, { rnd, learned });
  const ans = [];
  const judge = new FoodQuiz(foods, QUESTIONS); // the simulated user judges by the raw answer effects
  const answer = (q, i) => (i >= 0 && ans.push([q.id, i]), z.answer(q, i));

  const sim = (f) => (f.id === target.id ? 1 : jaccard(f.tags, target.tags));
  for (let i = 0; i < 40; i++) {
    const s = z.next();
    if (s.type === "done") break;
    if (s.type === "q") {
      const ds = s.q.answers.map((a) => judge.delta(target, s.q, a));
      const max = Math.max(...ds);
      if (rnd() < NOISE) answer(s.q, Math.floor(rnd() * ds.length));
      else if (ds.every((d) => d === 0)) answer(s.q, -1);
      else {
        const best = ds.map((d, j) => (d === max ? j : -1)).filter((j) => j >= 0);
        answer(s.q, best[Math.floor(rnd() * best.length)]);
      }
    } else if (s.type === "grid") {
      z.grid(s.items, s.items.filter((f) => f.id !== target.id && sim(f) < 0.15).map((f) => f.id));
    } else if (s.type === "duel") {
      const sa = sim(s.a);
      const sb = sim(s.b);
      z.duel(s.a, s.b, Math.max(sa, sb) < 0.15 ? "none" : sa >= sb ? "a" : "b");
    } else if (s.type === "guess") {
      z.guessResult(s.f, s.f.id === target.id ? "yes" : sim(s.f) >= 0.5 ? "close" : "no");
    } else if (s.type === "pick") {
      const hit = s.items.find((f) => f.id === target.id);
      z.choose(hit ?? "—");
      return { exact: false, found: !!hit, steps: z.n + 1, ans };
    }
  }
  return { exact: z.result?.f === target.id, found: z.result?.f === target.id, steps: z.n, ans };
}

function coverage() {
  const out = [];
  for (const q of QUESTIONS)
    for (const a of q.answers) {
      const pos = Object.entries(a.fx).filter(([, v]) => v > 0).map(([t]) => t);
      if (!pos.length) continue;
      const share = foods.filter((f) => pos.some((t) => f.tags.includes(t))).length / foods.length;
      out.push({ q: q.id, a: a.t, share });
    }
  return out;
}

function identical() {
  const seen = new Map();
  const dups = [];
  for (const f of foods) {
    const k = [...f.tags].sort().join(" ");
    if (seen.has(k)) dups.push(`${seen.get(k)} = ${f.id}`);
    else seen.set(k, f.id);
  }
  return dups;
}

let exact = 0, found = 0, steps = 0, n = 0;
const misses = [];
const hist = [];
for (const f of foods) {
  let fe = 0;
  for (let t = 0; t < TRIALS; t++) {
    const r = play(f, rng(1 + n * 7919));
    if (t === 0) hist.push({ f: f.id, ans: r.ans });
    n++;
    exact += r.exact;
    found += r.found;
    steps += r.steps;
    fe += r.exact;
  }
  if (fe / TRIALS < 0.5) misses.push(`${f.id} ${fe}/${TRIALS}`);
}
const R = { exact: exact / n, found: found / n, steps: steps / n };
const low = coverage().filter((c) => c.share < 0.05);
const dups = identical();
const pct = (x) => `${Math.round(x * 100)}%`;
console.log(`sim: exact ${pct(R.exact)} (≥${pct(TARGETS.exact)}) · found ${pct(R.found)} (≥${pct(TARGETS.found)}) · steps ${R.steps.toFixed(1)} (≤${TARGETS.steps}) · ${foods.length} foods × ${TRIALS}`);
if (low.length) console.log(`low-coverage answers (<5%): ${low.map((c) => `${c.q}:${c.a}`).join(", ")}`);
if (dups.length) console.log(`identical tags: ${dups.join(", ")}`);
if (VERBOSE && misses.length) console.log(`weak foods (${misses.length}): ${misses.join(", ")}`);
// Accuracy gates CI; the step target is reported only (see docs/REVIEW.md, step 1.3).
// Learning (§2.6) must never lower accuracy: replay with bonuses learned from one quiz per food.
const learned = learnFrom(hist, foods);
let lx = 0, ln = 0;
for (const f of foods) for (let t = 0; t < TRIALS; t++) (lx += play(f, rng(99 + ln * 7919), learned).exact), ln++;
const LX = lx / ln;
console.log(`sim: with learning exact ${pct(LX)} (baseline ${pct(R.exact)}, ${Object.keys(learned).length} learned answers)`);
const ok = R.exact >= TARGETS.exact && R.found >= TARGETS.found && LX >= R.exact - 0.02;
if (R.steps > TARGETS.steps) console.log(`sim: WARN average steps ${R.steps.toFixed(1)} > ${TARGETS.steps}`);
console.log(ok ? "sim: PASS" : "sim: BELOW TARGET");
process.exitCode = ok ? 0 : 1;
