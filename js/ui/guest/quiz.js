// Guest quiz screens (spec-flow-firebase.md §2.1). Also used for the owner's "she's next to me" mode.
// One question per screen, tap = answer. Escapes: 🤫 type it · ↪︎ undo. No skip on her screens (R5).
import { FOODS } from "../../data/foods.js";
import { QUESTIONS, questionText } from "../../data/questions.js";
import { STR } from "../../data/strings.js";
import { buildFoods } from "../../engine/foods.js";
import { priorFrom, knownFrom, novelEffects } from "../../engine/prior.js";
import { moodFor, cravingSummary } from "../../engine/mood.js";
import { FoodQuiz, questionsLeft, typeOf } from "../../engine/quiz.js";
import { learnFrom, seenFrom } from "../../engine/learn.js";
import { pic, qPic, catLabel, foodLabel } from "../pics.js";
import { BackLayer } from "../../router.js";
import { weatherKind } from "../../engine/weather.js";
import { holidayOf, heatwave } from "../../data/holidays.js";
import { allowedFoods, favBoosts } from "../../engine/exclude.js";
import { render, html, raw } from "../dom.js";

const DAY = 864e5;

/** Which part of the week this is: shabbat (Fri 17:00-Sat 19:00), friNoon (Fri 10-17), late (22-05), morning (05-11), noon (11-17), evening (17-22). */
export function momentOf(now = new Date()) {
  const d = now.getDay(), h = now.getHours();
  if ((d === 5 && h >= 17) || (d === 6 && h < 19)) return "shabbat";
  if (d === 5 && h >= 10) return "friNoon";
  return h >= 22 || h < 5 ? "late" : h < 11 ? "morning" : h < 17 ? "noon" : "evening";
}

/** Her quiz gets the night look from 20:00 to 05:00. */
export const isNight = (now = new Date()) => now.getHours() >= 20 || now.getHours() < 5;
export const BIG_KEY = "wte-big-text";
export const bigText = () => { try { return globalThis.localStorage?.getItem(BIG_KEY) === "1"; } catch { return false; } };

/** A warm one-liner for about 1 answer in 3, never one she already got this quiz. null = stay quiet. */
export function pickReaction(used, rnd = Math.random) {
  if (rnd() >= 1 / 3) return null;
  const left = STR.react.filter((x) => !used.has(x));
  if (!left.length) return null;
  const s = left[Math.min(left.length - 1, Math.floor(rnd() * left.length))];
  used.add(s);
  return s;
}

export const still = () => !globalThis.document || !!globalThis.WTE_NO_MOTION || !!globalThis.navigator?.webdriver || !!globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

let pruned;
import("../../engine/prune.js").then((m) => (pruned = m.prunedVariants), () => {});

const TYPE_MODS = {};
const loadType = (t) => (TYPE_MODS[t] ??= import(`./answers/${t}.js`).then((m) => (TYPE_MODS[t] = m), () => { delete TYPE_MODS[t]; return null; }));
const ANSWER_TYPES = ["slider", "thermo", "art", "color", "magnets", "faceoff"];

export function makeQuiz(room, historyList, { now = new Date(), rnd, weather = null } = {}) {
  if (globalThis.document) ANSWER_TYPES.forEach(loadType);
  const foods = allowedFoods(buildFoods(FOODS, room.custom ?? []), room.never); // "never for me": hard-excluded before the engine sees them
  const fav = (room.fav ?? []).filter((id) => foods.some((f) => f.id === id));
  const recent = historyList.filter((h) => h.f && now - new Date(h.at) <= 3 * DAY).map((h) => h.f);
  const prior = priorFrom(foods, { ratings: room.ratings ?? {}, recent, now, exp: room.exp ?? {}, weather, history: historyList });
  for (const [id, b] of Object.entries(favBoosts(fav))) prior[id] = (prior[id] ?? 0) + b;
  return new FoodQuiz(foods, QUESTIONS, prior, { rnd, learned: learnFrom(historyList, foods), seen: seenFrom(historyList), drop: pruned?.(historyList, foods, QUESTIONS).map((d) => d.id), known: knownFrom({ weather, history: historyList, now }), novel: novelEffects(historyList, foods, now, fav) });
}

/** Apply one recorded action to the engine. */
export function applyAction(z, a) {
  if (a.k === "a") {
    const q = z.qById.get(a.q);
    if (q) z.answer(q, a.i);
  }
  else if (a.k === "d") z.duel(z.food(a.a), z.food(a.b), a.c);
  else if (a.k === "t") z.gut(z.food(a.a), z.food(a.b), a.c);
  else if (a.k === "r") z.refine(a.x ?? {}, a.f ?? [], a.l);
  else if (a.k === "g") z.grid([], a.v ?? []);
  else if (a.k === "x") z.guessResult(z.food(a.f), a.r);
  else if (a.k === "n") z.rejectPick((a.f ?? []).map((id) => z.food(id)).filter(Boolean));
  else if (a.k === "c") z.choose(a.f ? z.food(a.f) : a.t);
}

/** Foods she turned down this session ("no" to a guess, "none of these" on a pick), minus the one she finally took. */
export function rejectedIds(actions, chosen = null) {
  const ids = [];
  for (const a of actions) {
    if (a.k === "x" && a.r === "no") ids.push(a.f);
    else if (a.k === "n") ids.push(...(a.f ?? []));
  }
  return [...new Set(ids)].filter((id) => id && id !== chosen).slice(0, 10);
}

/** The back bar at the top of every quiz screen (RTL: the arrow points right). */
export const backBar = (enabled = true) => html`<div class="qbar"><button class="btn back" data-on="qback" aria-label="${STR.backAria}"${enabled ? "" : raw(' aria-disabled="true"')}>→</button></div>`;

/**
 * startGuestQuiz(root, {room, history, actions?, onProgress?, onFinish?, onFeedback?, intro?})
 * onProgress({n, p1, trail, actions}) after every step · onFinish({result, food, mood, trail, top}) when done.
 */
export function startGuestQuiz(root, opts) {
  const { room, history = [], onProgress, onFinish, onFeedback, intro = true } = opts;
  const z = opts.quiz ?? makeQuiz(room, history, { weather: opts.weather });
  const holiday = STR.holiday[holidayOf(opts.now ?? new Date())] ?? "";
  const tease = heatwave(opts.weather) ? STR.holiday.heat : STR.weatherTease[weatherKind(opts.weather)] ?? "";
  const wx = STR.wxLine(opts.weather);
  const actions = [];
  for (const a of opts.actions ?? []) {
    try {
      applyAction(z, a);
      actions.push(a);
    } catch {
      break;
    }
  }
  const doc = root.ownerDocument ?? globalThis.document;
  doc?.documentElement?.classList.toggle("night", isNight(opts.now ?? new Date()));
  root.classList?.toggle("big-text", bigText()); // her "טקסט גדול" choice
  const her = room.settings?.her ?? "";
  const me = room.settings?.me ?? "";
  let gridVeto = new Set();
  let step = null;
  const layer = BackLayer.shared(opts.win).scope();
  const introShown = intro && !actions.length;
  let onIntro = introShown;
  let overlay = false;
  let pending = false;
  const usedReactions = new Set();
  const react = () => {
    const t = still() ? null : pickReaction(usedReactions, opts.reactRnd);
    if (!t) return;
    const d = document.createElement("div");
    d.className = "react";
    d.setAttribute("aria-hidden", "true");
    d.textContent = t;
    document.body.append(d);
    setTimeout(() => d.remove(), 900);
  };
  const refineMod = import("../../engine/refine.js"); // "why this?" lines and "Close, but…" nudges: loaded with her first pick, not at start-up
  let sealed = false;
  const uiSteps = [];
  const closeOverlay = () => (overlay = false);
  const progress = () => onProgress?.({ n: z.n, p1: z.ranked()[0]?.p ?? 0, trail: [...z.trail], actions: [...actions] });
  const undoOne = () => {
    if (!z.undo()) return;
    actions.pop();
    gridVeto = new Set();
    progress();
    show();
  };
  const canBack = () => !sealed && (overlay || uiSteps.length > 0 || actions.length > 0 || (introShown && !onIntro));
  const onBack = () => {
    if (sealed) return "stay";
    if (overlay) return void (closeOverlay(), show());
    if (uiSteps.length) return void uiSteps.pop()();
    if (actions.length) return void undoOne();
    if (introShown && !onIntro) return void showIntro();
    return "stay";
  };
  const goBack = () => {
    if (!canBack()) return void opts.onExit?.();
    if (!layer.back()) onBack();
  };
  const openOverlay = () => {
    overlay = true;
    layer.push(onBack);
  };
  if (opts.baseEntry) layer.push(onBack);
  for (let i = 0; i < actions.length; i++) layer.push(onBack);

  const cravingAnswers = () => [
    ...Object.values(z.known).map((k) => ({ q: k.q, i: k.i, inferred: true })),
    ...actions.filter((x) => x.k === "a" && (Array.isArray(x.i) || x.i >= 0)).map((x) => ({ q: x.q, i: x.i })),
  ];
  const meter = () => {
    const p1 = z.ranked()[0]?.p ?? 0;
    const n = questionsLeft(z.s.asked.length, p1);
    const { chips } = cravingSummary(cravingAnswers());
    return html`<div class="craving-card" aria-live="polite"><div class="line"><span class="sub">${STR.cravingTitle}</span><span class="sub qn" data-testid="qn">${p1 >= 0.75 ? STR.almost : STR.left(n)}</span></div>
      <div class="chips">${chips.length ? chips.map((c) => raw(html`<span class="chip${c.inferred ? " soft" : ""}">${c.label}</span>`)) : raw(html`<span class="chip empty">${STR.cravingEmpty}</span>`)}</div></div>`;
  };
  const footer = () => html`<div class="foot">
      ${actions.length ? raw(html`<button class="btn btn-ghost" data-on="undo">↪︎ ${STR.back}</button>`) : ""}
      <button class="btn btn-ghost" data-on="escape">${STR.escape}</button>
      ${onFeedback ? raw(html`<button class="btn btn-ghost" data-on="feedback">${STR.feedback.open}</button>`) : ""}</div>`;

  const act = (a) => {
    applyAction(z, a);
    actions.push(a);
    if (overlay) (closeOverlay(), layer.replaceTop(onBack)); // the escape screen's entry becomes this answer's
    else layer.push(onBack);
    progress();
    show();
  };

  const handlers = {
    go: () => ((onIntro = false), layer.push(onBack), show()),
    // "Like last time?": straight to that food's result (an entry shortcut, not a quiz answer); the normal start stays primary.
    like: (id) => ((onIntro = false), layer.push(onBack), act({ k: "c", f: id })),
    // Her profile: lazy module; its back button returns to the welcome screen.
    profile: () => import("./profile.js").then((m) => m.openProfile(root, opts.store, { onBack: showIntro })),
    qback: () => pending || goBack(),
    ans: (i, _e, el) => {
      if (pending) return;
      const a = { k: "a", q: step.q.id, i: String(i).includes(",") ? String(i).split(",").map(Number) : Number(i) };
      if (still()) return act(a);
      pending = true;
      el?.classList?.add("picked");
      root.querySelector?.(".chef")?.setAttribute("data-state", "nod");
      globalThis.navigator?.vibrate?.(10);
      react();
      setTimeout(() => ((pending = false), act(a)), 150);
    },
    undo: () => pending || goBack(),
    duel: (c) => act({ k: "d", a: step.a.id, b: step.b.id, c }),
    veto: (id, _e, el) => {
      gridVeto.has(id) ? gridVeto.delete(id) : gridVeto.add(id);
      el.setAttribute("aria-pressed", String(gridVeto.has(id)));
    },
    gridDone: () => {
      const v = [...gridVeto];
      gridVeto = new Set();
      act({ k: "g", v });
    },
    gut: (c) => act({ k: "t", a: step.a.id, b: step.b.id, c }),
    refine: (key) => refineMod.then((m) => act(m.refineAction(key, step.items.map((f) => f.id)))),
    guess: (r) => act({ k: "x", f: step.f.id, r }),
    pick: (id) => act({ k: "c", f: id }),
    pickNone: () => act({ k: "n", f: step.items.map((f) => f.id) }),
    escape: () => (openOverlay(), showEscape()),
    free: (fd) => {
      const t = String(fd.get("food") ?? "").trim().slice(0, 80);
      if (!t) return;
      const fits = z.matchAll(t);
      if (fits.length > 1) return showSeveral(fits);
      act(fits.length ? { k: "c", f: fits[0].id } : { k: "c", t });
    },
    back: () => goBack(),
    feedback: () => (openOverlay(), onFeedback?.(() => goBack())),
  };

  /** Several foods fit her typed words: she picks one (nothing is recorded until she does). */
  function showSeveral(fits) {
    render(root, html`${raw(backBar())}
      <h2 class="q">${STR.pick.several}</h2>
      <div class="grid">${fits.map((f) => raw(html`<button class="btn food" data-on="pick" data-arg="${f.id}">${raw(foodLabel(f))}</button>`))}</div>`, handlers);
  }

  function showEscape() {
    const list = z.foods.map((f) => raw(html`<option value="${f.name}"></option>`));
    render(root, html`${raw(backBar())}
      <h2 class="q">${STR.escapeScreen.text}</h2>
      <form data-submit="free" class="stack">
        <input name="food" list="food-list" autocomplete="off" maxlength="80" placeholder="${STR.escapeScreen.placeholder}" autofocus>
        <datalist id="food-list">${list}</datalist>
        <button class="btn btn-primary" type="submit">${STR.escapeScreen.send}</button>
      </form>
      <button class="btn back" data-on="back">${STR.escapeScreen.back}</button>`, handlers);
  }

  function show() {
    step = z.next();
    if (step.type === "done") return finish();
    let body = "";
    if (step.type === "q") {
      const { q, order } = step;
      const lead = actions.length ? "" : isNight(opts.now ?? new Date()) && !["late", "shabbat"].includes(momentOf(opts.now ?? new Date())) ? STR.night.lead : STR.moment[momentOf(opts.now ?? new Date())]?.lead;
      body = html`${lead ? raw(html`<p class="sub lead">${lead}</p>`) : ""}<h2 class="q">${questionText(q, opts.now ?? new Date())}</h2>
        <div class="answers" data-type="${typeOf(q)}">${order.map((i) => raw(html`<button class="btn" data-on="ans" data-arg="${i}"><span class="em">${raw(qPic(q.answers[i].e))}</span>${q.answers[i].t}</button>`))}</div>
        ${raw(footer())}`;
    } else if (step.type === "grid") {
      body = html`<h2 class="q">${STR.grid.text}</h2>
        <div class="grid">${step.items.map((f) => raw(html`<button class="btn food" data-on="veto" data-arg="${f.id}" aria-pressed="false">${raw(foodLabel(f))}</button>`))}</div>
        <button class="btn btn-primary" data-on="gridDone">${STR.grid.done}</button>
        ${raw(footer())}`;
    } else if (step.type === "duel") {
      const { a, b } = step;
      body = html`<h2 class="q">${STR.duel.text}</h2>
        <div class="duel">
          <button class="btn food" data-on="duel" data-arg="a">${raw(foodLabel(a, "big"))}</button>
          <button class="btn food" data-on="duel" data-arg="b">${raw(foodLabel(b, "big"))}</button>
        </div>
        <div class="duel">
          <button class="btn" data-on="duel" data-arg="both">${STR.duel.both}</button>
          <button class="btn" data-on="duel" data-arg="none">${STR.duel.neither}</button>
        </div>
        ${raw(footer())}`;
    } else if (step.type === "gut") {
      const { a, b } = step;
      body = html`<h2 class="q">${STR.gut.text}</h2>
        <div class="duel">
          <button class="btn food" data-on="gut" data-arg="a">${raw(foodLabel(a, "big"))}</button>
          <button class="btn food" data-on="gut" data-arg="b">${raw(foodLabel(b, "big"))}</button>
        </div>
        ${raw(footer())}`;
    } else if (step.type === "guess") {
      const f = step.f;
      body = html`<div class="sub">${STR.guess.text}</div>
        <div class="big reveal" aria-hidden="true">${raw(pic(f))}</div>
        <h2 class="title">${f.name}?</h2><p class="cat">${catLabel(f)}</p>
        <button class="btn btn-primary" data-on="guess" data-arg="yes">${STR.guess.yes}</button>
        <div class="duel">
          <button class="btn" data-on="guess" data-arg="close">${STR.guess.close}</button>
          <button class="btn" data-on="guess" data-arg="no">${STR.guess.no}</button>
        </div>
        ${raw(footer())}`;
    } else if (step.type === "pick") {
      body = html`<h2 class="q">${step.express ? STR.pick.express : step.unsure ? STR.pick.unsure : STR.pick.text}</h2>
        <div class="grid">${step.items.map((f) => raw(html`<button class="btn food" data-on="pick" data-arg="${f.id}">${raw(foodLabel(f))}${step.unsure ? raw(html`<small class="why" data-why="${f.id}"></small>`) : ""}</button>`))}</div>
        ${step.unsure ? raw(html`<div class="nudges" data-testid="nudges"></div>`) : ""}
        ${step.unsure ? raw(html`<button class="btn" data-on="pickNone">${STR.pick.none}</button>`) : ""}
        <button class="btn btn-ghost" data-on="escape">${STR.pick.free}</button>`;
    }
    render(root, backBar(canBack() || !!opts.onExit) + meter() + body, handlers);
    if (step.type === "pick" && step.unsure) fillPick(step);
    if (!still()) import("./chef.js").then((m) => m.place(root, step.type === "guess" || step.type === "pick" ? "drool" : "idle"), () => {});
    if (step.type === "q" && typeOf(step.q) !== "buttons" && root.querySelector && !globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches && !globalThis.WTE_NO_MOTION) {
      const on = step, host = root.querySelector(".answers"), t = typeOf(on.q);
      if (TYPE_MODS[t]?.mount) TYPE_MODS[t].mount(host, on.q, on.order);
      else loadType(t).then((m) => m && step === on && host?.isConnected && m.mount(host, on.q, on.order));
    }
    // two-choice screens also take a left or right swipe (lazy module; taps work without it)
    const two = !root.querySelectorAll ? [] : step.type === "q" ? [...root.querySelectorAll("[data-on=ans]")] : step.type === "duel" || step.type === "gut" ? [...root.querySelectorAll(".duel .food")] : [];
    if (two.length === 2) import("./swipe.js").then((m) => m.attachSwipe(step.type === "q" ? root : two[0].parentElement, two), () => {});
    if (actions.length && step.type === "q") root.classList?.remove("slide"), void root.offsetWidth, root.classList?.add("slide");
  }

  /** The 3 options get a "why" line each and the "Close, but…" nudges, once the lazy module is in (the screen works without them). */
  function fillPick(on) {
    refineMod.then((m) => {
      if (step !== on) return;
      const ans = cravingAnswers();
      for (const f of on.items) {
        const el = root.querySelector(`[data-why="${f.id}"]`);
        if (el) el.textContent = m.whyLine(f, ans);
      }
      const host = root.querySelector("[data-testid=nudges]");
      if (host) host.innerHTML = html`<p class="sub">${STR.refine.title}</p><div class="chips">${m.nudgesFor(ans).map((k) => raw(html`<button class="btn" data-on="refine" data-arg="${k}">${STR.refine.nudge[k]}</button>`))}</div>`;
    }, () => {});
  }

  function finish() {
    const r = z.result;
    const food = r.f ? z.food(r.f) : null;
    const answered = actions.filter((a) => a.k === "a");
    const stats = { hit: actions.at(-1)?.k === "x", steps: z.n, guesses: actions.filter((a) => a.k === "x").length, skips: answered.filter((a) => !Array.isArray(a.i) && a.i < 0).map((a) => a.q) };
    const ans = answered.filter((a) => Array.isArray(a.i) || a.i >= 0).flatMap((a) => (Array.isArray(a.i) ? a.i : [a.i]).map((i) => [a.q, i]));
    const rej = rejectedIds(actions, r.f);
    const out = { craving: cravingSummary(cravingAnswers()).line, result: r, food, rej, mood: moodFor(food), trail: [...z.trail], top: z.ranked().slice(0, 5).map((x) => x.f.id), ans, stats };
    out.back = goBack;
    out.step = (fn) => (uiSteps.push(fn), layer.push(onBack));
    out.seal = (on = true) => (sealed = on);
    if (onFinish) return onFinish(out);
    render(root, html`<div class="mood">${out.mood}</div>
      <div class="big">${raw(pic(food))}</div>
      <h2 class="title">${food?.name ?? r.free}</h2>`);
  }

  function showIntro() {
    onIntro = true;
    render(root, html`<h2 class="title">${STR.intro.hi(her)}</h2>
      <p class="sub">${STR.intro.text(me)}</p>
      ${holiday ? raw(html`<p class="sub holiday" data-testid="holiday">${holiday}</p>`) : ""}
      <p class="sub">${STR.moment[momentOf(opts.now ?? new Date())]?.intro ?? ""}</p>
      ${tease ? raw(html`<p class="sub">${tease}</p>`) : ""}
      ${wx ? raw(html`<p class="sub wx" data-testid="wx">${wx}</p>`) : ""}
      ${opts.note ? raw(html`<div class="note-card" data-testid="note-card"><small>${STR.noteFrom(me)}</small>${opts.note}</div>`) : ""}
      <button class="btn btn-primary" data-on="go" autofocus>${STR.intro.go}</button>
      <div data-testid="like-host"></div>
      ${opts.store ? raw(html`<button class="btn btn-ghost" data-on="profile" data-testid="profile-link">${STR.profile.link}</button>`) : ""}`, handlers);
    if (history.length) import("../../engine/lasttime.js").then((m) => {
      const now = opts.now ?? new Date();
      const foods = allowedFoods(buildFoods(FOODS, room.custom ?? []), room.never);
      const hit = m.likeLastTime(history, now, { never: room.never, foods });
      const host = onIntro && root.querySelector("[data-testid=like-host]");
      const food = hit && foods.find((f) => f.id === hit.f);
      if (host && food) host.innerHTML = html`<button class="btn like" data-on="like" data-arg="${food.id}" data-testid="like-card">${STR.like.card(STR.like.days[hit.day], food.name)} ${raw(pic(food, "sm"))}</button>`;
    }, () => {});
  }
  if (introShown) showIntro();
  else show();
  return z;
}
