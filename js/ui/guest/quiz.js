// Guest quiz screens (spec-flow-firebase.md §2.1). Also used for the owner's "she's next to me" mode.
// One question per screen, tap = answer. Escapes: 🤫 type it · ↪︎ undo. No skip on her screens (R5).
import { FOODS } from "../../data/foods.js";
import { QUESTIONS, questionText } from "../../data/questions.js";
import { STR } from "../../data/strings.js";
import { buildFoods } from "../../engine/foods.js";
import { priorFrom, knownFrom, novelEffects } from "../../engine/prior.js";
import { moodFor, cravingSummary } from "../../engine/mood.js";
import { FoodQuiz, questionsLeft } from "../../engine/quiz.js";
import { learnFrom, seenFrom } from "../../engine/learn.js";
import { pic, catLabel, foodLabel } from "../pics.js";
import { BackLayer } from "../../router.js";
import { weatherKind } from "../../engine/weather.js";
import { render, html, raw } from "../dom.js";

const DAY = 864e5;

/** Foods, prior and engine for a room. */
export function makeQuiz(room, historyList, { now = new Date(), rnd, weather = null } = {}) {
  const foods = buildFoods(FOODS, room.custom ?? []);
  const recent = historyList.filter((h) => h.f && now - new Date(h.at) <= 3 * DAY).map((h) => h.f);
  const prior = priorFrom(foods, { ratings: room.ratings ?? {}, recent, now, exp: room.exp ?? {}, weather, history: historyList });
  return new FoodQuiz(foods, QUESTIONS, prior, { rnd, learned: learnFrom(historyList, foods), seen: seenFrom(historyList), known: knownFrom({ weather, history: historyList, now }), novel: novelEffects(historyList, foods, now) });
}

/** Apply one recorded action to the engine. */
export function applyAction(z, a) {
  if (a.k === "a") {
    const q = z.qById.get(a.q);
    if (q) z.answer(q, a.i); // a v1 question id from a quiz she started before the update: dropped
  }
  else if (a.k === "d") z.duel(z.food(a.a), z.food(a.b), a.c);
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
  const tease = STR.weatherTease[weatherKind(opts.weather)] ?? "";
  const actions = [];
  for (const a of opts.actions ?? []) {
    try {
      applyAction(z, a);
      actions.push(a);
    } catch {
      break; // stale log (food removed, bank changed): keep what replayed
    }
  }
  const her = room.settings?.her ?? "";
  const me = room.settings?.me ?? "";
  let gridVeto = new Set();
  let step = null;
  const layer = BackLayer.shared(opts.win).scope();
  const introShown = intro && !actions.length;
  let onIntro = introShown;
  let overlay = false;
  let sealed = false; // after the result was sent: back never undoes it (and never resends)
  const uiSteps = []; // screens the caller shows after the quiz ends (e.g. a failed send); each closer restores the one before
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
  if (opts.baseEntry) layer.push(onBack); // guest page (nothing below it): back on the very first screen stays instead of leaving the app
  for (let i = 0; i < actions.length; i++) layer.push(onBack); // a resumed quiz: one entry per replayed step

  const cravingAnswers = () => [
    ...Object.values(z.known).map((k) => ({ q: k.q, i: k.i, inferred: true })),
    ...actions.filter((x) => x.k === "a" && x.i >= 0).map((x) => ({ q: x.q, i: x.i })),
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
    qback: () => goBack(),
    ans: (i) => act({ k: "a", q: step.q.id, i: Number(i) }),
    undo: () => goBack(),
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
      body = html`<h2 class="q">${questionText(q, opts.now ?? new Date())}</h2>
        ${order.map((i) => raw(html`<button class="btn" data-on="ans" data-arg="${i}"><span class="em">${q.answers[i].e}</span>${q.answers[i].t}</button>`))}
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
        <div class="grid">${step.items.map((f) => raw(html`<button class="btn food" data-on="pick" data-arg="${f.id}">${raw(foodLabel(f))}</button>`))}</div>
        ${step.unsure ? raw(html`<button class="btn" data-on="pickNone">${STR.pick.none}</button>`) : ""}
        <button class="btn btn-ghost" data-on="escape">${STR.pick.free}</button>`;
    }
    render(root, backBar(canBack() || !!opts.onExit) + meter() + body, handlers);
  }

  function finish() {
    const r = z.result;
    const food = r.f ? z.food(r.f) : null;
    const answered = actions.filter((a) => a.k === "a");
    const stats = { hit: actions.at(-1)?.k === "x", steps: z.n, guesses: actions.filter((a) => a.k === "x").length, skips: answered.filter((a) => a.i < 0).map((a) => a.q) };
    const ans = answered.filter((a) => a.i >= 0).map((a) => [a.q, a.i]);
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
      ${tease ? raw(html`<p class="sub">${tease}</p>`) : ""}
      <button class="btn btn-primary" data-on="go" autofocus>${STR.intro.go}</button>`, handlers);
  }
  if (introShown) showIntro();
  else show();
  return z;
}
