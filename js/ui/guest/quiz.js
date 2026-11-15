// Guest quiz screens (spec-flow-firebase.md §2.1). Also used for the owner's "she's next to me" mode.
// One question per screen, tap = answer. Escapes: 🤫 type it · ↩︎ undo. No skip on her screens (R5).
// Every step is kept as a small action so the quiz can resume on another browser (live doc).
import { FOODS } from "../../data/foods.js";
import { QUESTIONS } from "../../data/questions.js";
import { STR } from "../../data/strings.js";
import { buildFoods } from "../../engine/foods.js";
import { priorFrom } from "../../engine/prior.js";
import { moodFor } from "../../engine/mood.js";
import { FoodQuiz } from "../../engine/quiz.js";
import { learnFrom } from "../../engine/learn.js";
import { pic, catLabel, foodLabel } from "../pics.js";
import { BackLayer } from "../../router.js";
import { weatherKind } from "../../engine/weather.js";
import { render, html, raw } from "../dom.js";

const DAY = 864e5;

/** Foods, prior and engine for a room. */
export function makeQuiz(room, historyList, { now = new Date(), rnd, weather = null } = {}) {
  const foods = buildFoods(FOODS, room.custom ?? []);
  const recent = historyList.filter((h) => h.f && now - new Date(h.at) <= 3 * DAY).map((h) => h.f);
  const prior = priorFrom(foods, { ratings: room.ratings ?? {}, recent, now, exp: room.exp ?? {}, weather });
  return new FoodQuiz(foods, QUESTIONS, prior, { rnd, learned: learnFrom(historyList, foods) });
}

/** Apply one recorded action to the engine. */
export function applyAction(z, a) {
  if (a.k === "a") z.answer(z.questions.find((q) => q.id === a.q), a.i);
  else if (a.k === "d") z.duel(z.food(a.a), z.food(a.b), a.c);
  else if (a.k === "g") z.grid([], a.v ?? []);
  else if (a.k === "x") z.guessResult(z.food(a.f), a.r);
  else if (a.k === "c") z.choose(a.f ? z.food(a.f) : a.t);
}

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
  // Back gesture = the in-app back: one answer back, or close the escape/feedback screen.
  const layer = BackLayer.shared(opts.win).scope();
  let overlay = false;
  const closeOverlay = () => (overlay = false);
  const undoOne = () => {
    if (!z.undo()) return;
    actions.pop();
    gridVeto = new Set();
    onProgress?.({ n: z.n, p1: z.ranked()[0]?.p ?? 0, trail: [...z.trail], actions: [...actions] });
    show();
  };
  const onBack = () => (overlay ? (closeOverlay(), show()) : undoOne());
  const openOverlay = () => {
    overlay = true;
    layer.push(onBack);
  };

  const meter = () => {
    const p1 = z.ranked()[0]?.p ?? 0;
    const w = Math.round(Math.max(0.1, Math.min(1, p1)) * 100);
    return html`<div class="meter-wrap"><span class="sub">${STR.meter}</span>
      <div class="meter" role="meter" aria-label="${STR.meter}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${w}"><i style="width:${w}%"></i></div></div>`;
  };
  const footer = () => html`<div class="foot">
      ${actions.length ? raw(html`<button class="btn btn-ghost" data-on="undo">↩︎ ${STR.back}</button>`) : ""}
      <button class="btn btn-ghost" data-on="escape">${STR.escape}</button>
      ${onFeedback ? raw(html`<button class="btn btn-ghost" data-on="feedback">${STR.feedback.open}</button>`) : ""}</div>`;

  const act = (a) => {
    applyAction(z, a);
    actions.push(a);
    if (overlay) (closeOverlay(), layer.replaceTop(onBack)); // the escape screen's entry becomes this answer's
    else layer.push(onBack);
    onProgress?.({ n: z.n, p1: z.ranked()[0]?.p ?? 0, trail: [...z.trail], actions: [...actions] });
    show();
  };

  const handlers = {
    go: () => show(),
    ans: (i) => act({ k: "a", q: step.q.id, i: Number(i) }),
    undo: () => (layer.depth && !overlay ? layer.back() : undoOne()),
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
    escape: () => (openOverlay(), showEscape()),
    free: (fd) => {
      const t = String(fd.get("food") ?? "").trim().slice(0, 80);
      if (!t) return;
      const f = z.match(t);
      act(f ? { k: "c", f: f.id } : { k: "c", t });
    },
    back: () => (overlay ? layer.back() : show()),
    feedback: () => (openOverlay(), onFeedback?.(() => (overlay ? layer.back() : show()))),
  };

  function showEscape() {
    const list = z.foods.map((f) => raw(html`<option value="${f.name}"></option>`));
    render(root, html`
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
      body = html`<h2 class="q">${q.text}</h2>
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
      body = html`<h2 class="q">${step.express ? STR.pick.express : STR.pick.text}</h2>
        <div class="grid">${step.items.map((f) => raw(html`<button class="btn food" data-on="pick" data-arg="${f.id}">${raw(foodLabel(f))}</button>`))}</div>
        <button class="btn btn-ghost" data-on="escape">${STR.pick.free}</button>`;
    }
    render(root, meter() + body, handlers);
  }

  function finish() {
    const r = z.result;
    const food = r.f ? z.food(r.f) : null;
    const answered = actions.filter((a) => a.k === "a");
    const stats = { hit: actions.at(-1)?.k === "x", steps: z.n, guesses: actions.filter((a) => a.k === "x").length, skips: answered.filter((a) => a.i < 0).map((a) => a.q) };
    const ans = answered.filter((a) => a.i >= 0).map((a) => [a.q, a.i]);
    const out = { result: r, food, mood: moodFor(food), trail: [...z.trail], top: z.ranked().slice(0, 5).map((x) => x.f.id), ans, stats };
    layer.clear(); // after the result there is nothing to step back into
    if (onFinish) return onFinish(out);
    render(root, html`<div class="mood">${out.mood}</div>
      <div class="big">${raw(pic(food))}</div>
      <h2 class="title">${food?.name ?? r.free}</h2>`);
  }

  if (intro && !actions.length)
    render(root, html`<h2 class="title">${STR.intro.hi(her)}</h2>
      <p class="sub">${STR.intro.text(me)}</p>
      ${tease ? raw(html`<p class="sub">${tease}</p>`) : ""}
      <button class="btn btn-primary" data-on="go" autofocus>${STR.intro.go}</button>`, handlers);
  else show();
  return z;
}
