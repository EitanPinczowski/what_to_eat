// Guest taste sweep (PLAN.md §7.3, spec §2.8): one card per food, swipe and visible buttons, undo,
// skipped pile, optional note, "finished, send" anytime → extras → send. Resumable via rooms/{id}/live/sweep.
import { FOODS } from "../../data/foods.js";
import { STR } from "../../data/strings.js";
import { RATING_EMOJI } from "../../data/constants.js";
import { buildFoods } from "../../engine/foods.js";
import { newId } from "../../share/codec.js";
import { buildResultLink } from "../../share/links.js";
import { waUrl } from "../../share/whatsapp.js";
import { pic, catLabel, foodLabel } from "../pics.js";
import { render, html, raw, confetti, saveFailed } from "../dom.js";
import { BackLayer } from "../../router.js";
import { withTimeout, ping, installErrorLog } from "./session.js";
import { notifyAll } from "../../push.js";

const W = STR.sweep;
const SWIPE = 70; // px
const SWIPE_RATE = { right: 4, left: 2 }; // right = 😍, left = 😐 (never 🤢 by accident)

/** Order of food ids to show: unrated only, or all; shuffled. */
export function sweepOrder(foods, ratings, mode = "unrated", rnd = Math.random) {
  const ids = foods.filter((f) => mode === "all" || !ratings[f.id]?.r).map((f) => f.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

/** Split her free-text extras into inbox items. */
export function splitExtras(text) {
  return [...new Set(String(text ?? "").split(/[,،\n]+/).map((s) => s.trim().slice(0, 40)).filter(Boolean))].slice(0, 20);
}

export async function runSweep(root, store, { base = location.origin + location.pathname } = {}) {
  const room = store.get();
  const s = room.settings;
  const foods = buildFoods(FOODS, room.custom);
  const byId = new Map(foods.map((f) => [f.id, f]));
  let screen = "intro";
  installErrorLog(store, () => screen);

  const prev = store.doc("live", "sweep") ?? {};
  const st = {
    order: (prev.order?.length && !prev.finished ? prev.order : sweepOrder(foods, room.ratings, prev.mode)).filter((id) => byId.has(id)),
    i: prev.finished ? 0 : prev.i ?? 0,
    skipped: prev.finished ? [] : prev.skipped ?? [],
    given: prev.finished ? {} : prev.given ?? {}, // this session's ratings, for the #r= fallback
    notes: {},
    undo: [],
    mode: prev.mode ?? "unrated",
  };
  const save = (extra = {}) =>
    store
      .put("live", "sweep", { mode: st.mode, order: st.order, i: st.i, skipped: st.skipped, given: st.given, n: st.order.length, finished: false, at: new Date().toISOString(), ...extra })
      .catch(saveFailed);

  const layer = BackLayer.shared().scope();
  const rate = (id, r) => {
    layer.push(undoOne);
    st.undo.push({ i: st.i, skipped: [...st.skipped], id, before: store.get().ratings[id] ?? null });
    if (r) {
      st.given[id] = r;
      store.update((db) => (db.ratings[id] = { ...(db.ratings[id] ?? {}), r })).catch(saveFailed);
    } else st.skipped.push(id);
    st.i++;
    save();
    card();
  };

  const undoOne = () => {
      const u = st.undo.pop();
      if (!u) return;
      st.i = u.i;
      st.skipped = u.skipped;
      delete st.given[u.id];
      store.update((db) => (u.before ? (db.ratings[u.id] = u.before) : delete db.ratings[u.id])).catch(saveFailed);
      save();
      card();
    };

  const handlers = {
    go: () => card(),
    rate: (r) => rate(st.order[st.i], Number(r)),
    skip: () => rate(st.order[st.i], 0),
    undo: () => (layer.depth ? layer.back() : undoOne()),
    note: () => {
      const id = st.order[st.i];
      const box = root.querySelector(".note-box");
      if (box) box.hidden = !box.hidden;
      box?.querySelector("input")?.focus();
      st.noteFor = id;
    },
    noteText: (v) => {
      const id = st.order[st.i];
      const n = v.trim().slice(0, 200);
      st.notes[id] = n;
      clearTimeout(st.noteTimer);
      st.noteTimer = setTimeout(() => store.update((db) => (db.ratings[id] = { ...(db.ratings[id] ?? { r: 0 }), ...(n ? { n } : {}) })).catch(saveFailed), 600);
    },
    redoSkipped: () => {
      st.order = [...st.order.slice(0, st.i), ...st.skipped];
      st.skipped = [];
      save();
      card();
    },
    finish: () => (layer.clear(), extras()),
  };

  function card() {
    if (st.i >= st.order.length && st.skipped.length === 0) return extras();
    screen = `card${st.i}`;
    const f = byId.get(st.order[st.i]);
    const foot = html`<div class="pile">
        ${st.undo.length ? raw(html`<button class="chip" data-on="undo">↩︎ ${STR.back}</button>`) : raw("<span></span>")}
        <span>${W.skipped(st.skipped.length)}</span>
        <span>${W.count(Math.min(st.i, st.order.length), st.order.length)}</span></div>
      <button class="btn btn-ghost" data-on="finish">${W.finish}</button>`;
    if (!f) {
      render(root, html`<p class="sub">${W.skipped(st.skipped.length)}</p>
        <button class="btn btn-primary" data-on="redoSkipped">${W.backToSkipped}</button>${raw(foot)}`, handlers);
      return;
    }
    render(root, html`<div class="sub">${W.howMuch}</div>
      <div class="card sweep-card" data-testid="card"><div class="big">${raw(pic(f))}</div><h2 class="title">${f.name}</h2><p class="cat">${catLabel(f)}</p></div>
      <div class="rates big-rates">${[1, 2, 3, 4].map((r) => raw(html`<button class="chip" data-on="rate" data-arg="${r}" aria-label="${RATING_EMOJI[r]}">${RATING_EMOJI[r]}</button>`))}</div>
      <button class="btn btn-ghost" data-on="skip">${W.skip}</button>
      <button class="btn btn-ghost" data-on="note">${W.note}</button>
      <div class="note-box" hidden><input data-input="noteText" maxlength="200" placeholder="${W.notePh}" value="${st.notes[f.id] ?? ""}"></div>
      ${raw(foot)}`, handlers);
    swipe(root.querySelector(".sweep-card"), f.id);
  }

  function swipe(el, id) {
    let x0 = null;
    el.addEventListener("pointerdown", (e) => ((x0 = e.clientX), el.setPointerCapture?.(e.pointerId)));
    el.addEventListener("pointermove", (e) => x0 !== null && (el.style.transform = `translateX(${e.clientX - x0}px) rotate(${(e.clientX - x0) / 20}deg)`));
    el.addEventListener("pointercancel", () => ((x0 = null), (el.style.transform = "")));
    el.addEventListener("pointerup", (e) => {
      const dx = e.clientX - (x0 ?? e.clientX);
      x0 = null;
      el.style.transform = "";
      if (Math.abs(dx) >= SWIPE) rate(id, SWIPE_RATE[dx > 0 ? "right" : "left"]);
    });
  }

  function extras() {
    screen = "extras";
    render(root, html`<h2 class="q">${W.extras}</h2>
      <form data-submit="send" class="stack">
        <textarea name="x" rows="3" maxlength="400" placeholder="${W.extrasPh}"></textarea>
        <button class="btn btn-primary" type="submit">${W.send(s.me)}</button>
      </form>`, {
      send: async (fd, _e, form) => {
        form.querySelector("button").disabled = true;
        const x = splitExtras(fd.get("x"));
        const id = newId(16);
        try {
          await withTimeout(
            Promise.all([
              x.length ? store.update((db) => (db.inbox = [...new Set([...db.inbox, ...x])].slice(-300))) : Promise.resolve(),
              store.put("live", "sweep", { mode: st.mode, order: [], i: 0, skipped: [], given: {}, n: st.order.length, done: Object.keys(st.given).length, finished: true, at: new Date().toISOString() }),
            ]),
            8000,
          );
          ping(s.ntfy, W.ntfy(s.her));
          notifyAll(s, "sweep");
          confetti();
          render(root, html`<div class="big reveal" aria-hidden="true">💌</div><h2 class="title" role="status">${STR.result.sent(s.me)}</h2>`);
        } catch {
          const link = buildResultLink(base, { t: "rate", id, r: st.given, n: Object.fromEntries(Object.entries(st.notes).filter(([k, t]) => t && k in st.given).slice(0, 20).map(([k, t]) => [k, t.slice(0, 80)])), x: (x ?? []).slice(0, 10).map((t) => String(t).slice(0, 40)) });
          render(root, html`<p class="sub" role="alert">${STR.result.failed}</p>
            <a class="btn btn-primary" href="${waUrl(link, s.myPhone)}" target="_blank" rel="noopener">${STR.result.wa}</a>`);
        }
      },
    });
  }

  if (st.i > 0) card();
  else
    render(root, html`<h2 class="title">${W.hi(s.her)}</h2><p class="sub">${W.text}</p>
      <button class="btn btn-primary" data-on="go" autofocus>${W.go}</button>`, handlers);
}
