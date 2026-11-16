// Accuracy simulation for the guessing engine (PLAN.md §6.5).
// A simulated guest answers consistently with a hidden target food, with 15% noise.
// Usage: node tests/sim.js [trials-per-food=5] [--verbose]
import { FOODS } from "../js/data/foods.js";
import { QUESTIONS } from "../js/data/questions.js";
import { buildFoods } from "../js/engine/foods.js";
import { jaccard } from "../js/engine/similarity.js";
import { FoodQuiz } from "../js/engine/quiz.js";
import { learnFrom, hitFrom, rankIn } from "../js/engine/learn.js";

const TRIALS = Number(process.argv[2]) || 5;
const VERBOSE = process.argv.includes("--verbose");
const NOISE = 0.15;
const TARGETS = { found: 0.945, steps: 10, express: 0.60 };
// Honest accuracy (docs/REVIEW.md): regression floors = measured value rounded down to 5 points; PRODUCT = report-only goals.
const FLOORS = { first: 0.65, top3: 0.95, never: 6 }; // never = foods that are never the first guess at noise 0 (item 15) // at noise 0.15, tired, learned history
const PRODUCT = { first: 0.45, top3: 0.85, steps: 9 };
const LEVELS = [0, 0.15, 0.3];
const TIRED_AFTER = 8, TIRED_ADD = 0.1; // found was 0.95; no-skip rule (1.6) costs ~1 trial in 475 — see docs/REVIEW.md

const TUNE = {}; // tuning only: PICK_BELOW=0.4 PICK_DISTINCT=0 node tests/sim.js
if (process.env.PICK_BELOW) TUNE.pickBelow = Number(process.env.PICK_BELOW);
if (process.env.PICK_DISTINCT) TUNE.pickDistinct = process.env.PICK_DISTINCT !== "0";
const foods = buildFoods(FOODS);
const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function play(target, rnd, learned = {}, noiseAt = () => NOISE) {
  const z = new FoodQuiz(foods, QUESTIONS, {}, { rnd, learned, ...TUNE });
  const ans = [];
  const judge = new FoodQuiz(foods, QUESTIONS); // the simulated user judges by the raw answer effects
  const jt = judge.byId.get(target.id);
  const offered = []; // food ids shown as guesses / picks, in order
  let guesses = 0, inPick = false;
  const hit3 = () => hitFrom(rankIn(offered, target.id)); // the one definition of a hit (js/engine/learn.js)
  const answer = (q, i) => (i >= 0 && ans.push([q.id, i]), z.answer(q, i));

  const sim = (f) => (f.id === target.id ? 1 : jaccard(f.tags, target.tags));
  const lean = (q) => {
    const sc = q.answers.map((a) => judge.foods.reduce((s, f) => s + (f.id === target.id ? 0 : judge.delta(f, q, a)), 0));
    return sc.indexOf(Math.min(...sc));
  };
  for (let i = 0; i < 40; i++) {
    const s = z.next();
    if (s.type === "done") break;
    if (s.type === "q") {
      const ds = s.q.answers.map((a) => judge.delta(jt, s.q, a)); // jt carries the cuisine tags (c:<id>) she answers by
      const max = Math.max(...ds);
      if (rnd() < noiseAt(z.n)) answer(s.q, Math.floor(rnd() * ds.length));
      else if (ds.every((d) => d === 0)) answer(s.q, lean(s.q)); // no skip on her screens (R5): she leans toward foods like her target
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
      guesses++;
      offered.push(s.f.id);
      z.guessResult(s.f, s.f.id === target.id ? "yes" : sim(s.f) >= 0.5 ? "close" : "no");
    } else if (s.type === "pick") {
      const hit = s.items.find((f) => f.id === target.id);
      inPick = !!hit;
      offered.push(...s.items.map((f) => f.id));
      if (s.unsure && !hit) {
        z.rejectPick(s.items); // "none of these": the quiz goes on
        continue;
      }
      z.choose(hit ?? "—");
      return { exact: false, found: !!hit, steps: z.n + 1, ans, express: !!s.express || (!!s.unsure && z.s.big), first: hit3().first, top3: inPick || hit3().top3, guesses, win: offered[0] };
    }
  }
  const ok = z.result?.f === target.id;
  if (z.result?.f && !offered.length) offered.push(z.result.f);
  return { exact: ok, found: ok, steps: z.n, ans, express: false, first: hit3().first, top3: hit3().top3, guesses, win: offered[0] };
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
let mn = 0, xf = 0, xn = 0; // 🦖 express runs (end on a 3-item shortlist) are gated separately
const misses = [];
const hist = [];
for (const f of foods) {
  let fe = 0;
  for (let t = 0; t < TRIALS; t++) {
    const r = play(f, rng(1 + n * 7919));
    if (t === 0) hist.push({ f: f.id, ans: r.ans });
    n++;
    if (r.express) {
      xn++;
      xf += r.found;
      continue;
    }
    mn++;
    exact += r.exact;
    found += r.found;
    steps += r.steps;
    fe += r.exact;
  }
  if (fe / TRIALS < 0.5) misses.push(`${f.id} ${fe}/${TRIALS}`);
}
const R = { exact: exact / mn, found: found / mn, steps: steps / mn };
const XF = xn ? xf / xn : 1;
const low = coverage().filter((c) => c.share < 0.05);
const dups = identical();
const pct = (x) => `${Math.round(x * 100)}%`;
console.log(`sim: final-result exact ${pct(R.exact)} (not gated: counts runs after wrong guesses) · found ${pct(R.found)} (≥${pct(TARGETS.found)}) · steps ${R.steps.toFixed(1)} (≤${TARGETS.steps}) · ${foods.length} foods × ${TRIALS}`);
console.log(`sim: 🦖 express runs ${xn}/${n} · target in the 3-item shortlist ${pct(XF)} (≥${pct(TARGETS.express)})`);
if (low.length) console.log(`low-coverage answers (<5%): ${low.map((c) => `${c.q}:${c.a}`).join(", ")}`);
if (dups.length) console.log(`identical tags: ${dups.join(", ")}`);
if (VERBOSE && misses.length) console.log(`weak foods (${misses.length}): ${misses.join(", ")}`);
// Accuracy gates CI; the step target is reported only (see docs/REVIEW.md, step 1.3).
// Learning (§2.6) must never lower accuracy: replay with bonuses learned from one quiz per food.
const learned = learnFrom(hist, foods);
let lx = 0, ln = 0, lm = 0;
for (const f of foods)
  for (let t = 0; t < TRIALS; t++) {
    const r = play(f, rng(99 + ln * 7919), learned);
    ln++;
    if (!r.express) (lx += r.exact), lm++;
  }
const LX = lx / lm;
console.log(`sim: with learning exact ${pct(LX)} (baseline ${pct(R.exact)}, ${Object.keys(learned).length} learned answers)`);
// Honest accuracy: first guess / top 3 / guesses shown, at three noise levels, noise +0.10 after step 8,
// each starting from a history of one earlier quiz per food (learned bonuses), not an empty one.
const table = {};
const perFood = {};
for (const lv of LEVELS) {
  const noiseAt = (n) => lv + (n > TIRED_AFTER ? TIRED_ADD : 0);
  const h = [];
  let k = 0;
  for (const f of foods) h.push({ f: f.id, ans: play(f, rng(5 + k++ * 104729), {}, noiseAt).ans });
  const lrn = learnFrom(h, foods);
  let m = 0, mm = 0, fi = 0, t3 = 0, gs = 0, st = 0, xr = 0, xh = 0, xs = 0;
  const per = new Map(foods.map((f) => [f.id, { first: 0, top3: 0, steps: 0, wins: {}, runs: 0 }]));
  for (const f of foods)
    for (let t = 0; t < TRIALS; t++) {
      const r = play(f, rng(31 + m++ * 7919), lrn, noiseAt);
      const p = per.get(f.id);
      p.steps += r.steps;
      st += r.steps;
      if (r.express) {
        // 🦖 express runs end on 3 options after 4 steps by design: gated on their own (item 17), kept out of the first/top-3 floors.
        xr++, (xh += r.found), (xs += r.steps);
        continue;
      }
      p.runs++; mm++;
      p.first += r.first; p.top3 += r.top3;
      if (!r.first && r.win) p.wins[r.win] = (p.wins[r.win] || 0) + 1;
      fi += r.first; t3 += r.top3; gs += r.guesses;
    }
  perFood[lv] = per;
  table[lv] = { first: fi / mm, top3: t3 / mm, guesses: gs / mm, steps: st / m, express: xr ? xh / xr : 1, xsteps: xr ? xs / xr : 0 };
}
console.log(`sim: honest accuracy (tired after step ${TIRED_AFTER}: +${TIRED_ADD} noise; learned history; ${foods.length} foods x ${TRIALS})`);
console.log(`noise | first guess (target ${pct(PRODUCT.first)}) | top 3 (target ${pct(PRODUCT.top3)}) | guesses | steps (target <=${PRODUCT.steps}) | express shortlist (steps)`);
for (const lv of LEVELS) {
  const t = table[lv];
  console.log(`${lv.toFixed(2)}  | ${pct(t.first).padStart(4)} | ${pct(t.top3).padStart(4)} | ${t.guesses.toFixed(1)} | ${t.steps.toFixed(1)} | ${pct(t.express)} (${t.xsteps.toFixed(1)})`);
}
// Road-stop foods (item 16): what she grabs at a petrol station; report line, steps target <= 9.
const ROAD = ["coffee_pastry", "protein_bar", "yogurt_cup", "iced_coffee", "toast", "sandwich", "burekas", "croissant", "smoothie", "granola"];
for (const lv of LEVELS) {
  const rs = ROAD.map((id) => perFood[lv]?.get(id)).filter(Boolean);
  const rst = rs.reduce((x, p) => x + p.steps, 0) / (rs.length * TRIALS), rfi = rs.reduce((x, p) => x + p.first, 0) / (rs.reduce((x, p) => x + p.runs, 0) || 1);
  console.log(`sim: road foods at noise ${lv.toFixed(2)}: avg steps ${rst.toFixed(1)} (target <=9) first guess ${pct(rfi)}`);
}
// Report-only per-food view (--foods): never first guess, rarely in the top 3, and who wins instead.
if (process.argv.includes("--foods")) {
  for (const lv of [0, 0.15].filter((l) => perFood[l])) {
    console.log(`per-food at noise ${lv}: never first / top3 under half / confused with`);
    for (const [id, p] of perFood[lv]) {
      if (p.first > 0 && p.top3 / (p.runs || 1) >= 0.5) continue;
      const w = Object.entries(p.wins).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k}x${v}`).join(" ");
      console.log(`  ${id}: first ${p.first}/${p.runs} top3 ${p.top3}/${p.runs} <- ${w}`);
    }
  }
}
// Every food must be the first guess at least sometimes with a perfect guest (noise 0).
const never = [...(perFood[0] ?? [])].filter(([, p]) => p.runs >= TRIALS - 1 && p.first === 0).map(([id]) => id);
if (never.length) console.log(`sim: never the first guess at noise 0 (${never.length}): ${never.join(", ")}`);
const H = table[0.15];
if (H.first < PRODUCT.first || H.top3 < PRODUCT.top3 || H.steps > PRODUCT.steps) console.log(`sim: report-only product targets not met at noise 0.15`);
const honest = H.first >= FLOORS.first && H.top3 >= FLOORS.top3 && never.length <= FLOORS.never;
if (!honest) console.log(`sim: regression floor missed at noise 0.15: first ${pct(H.first)} (>=${pct(FLOORS.first)}), top3 ${pct(H.top3)} (>=${pct(FLOORS.top3)}), never-first foods ${never.length} (<=${FLOORS.never})`);
const ok = honest && R.found >= TARGETS.found && XF >= TARGETS.express && LX >= R.exact - 0.02;
if (R.steps > TARGETS.steps) console.log(`sim: WARN average steps ${R.steps.toFixed(1)} > ${TARGETS.steps}`);
console.log(ok ? "sim: PASS" : "sim: BELOW TARGET");
process.exitCode = ok ? 0 : 1;
