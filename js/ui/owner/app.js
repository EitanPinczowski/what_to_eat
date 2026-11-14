// Owner app: home + view stack (send quiz, she's-next-to-me, history). Later steps add brain, places, picker, settings.
import { STR } from "../../data/strings.js";
import { newId } from "../../share/codec.js";
import { buildQuizLink } from "../../share/links.js";
import { waUrl } from "../../share/whatsapp.js";
import { ViewStack } from "../../router.js";
import { render, html, raw, toast, copy, confetti } from "../dom.js";
import { startGuestQuiz } from "../guest/quiz.js";
import { finishForm, resultEntry } from "../guest/session.js";
import { brainViews } from "./brain.js";

const T = STR.owner;
const fmtDate = (iso) => {
  try {
    return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "numeric", weekday: "short" });
  } catch {
    return "";
  }
};

/** Live status line for the guest's quiz (from rooms/{id}/live/quiz). */
export function liveStatus(live, her) {
  if (!live?.opened) return T.status.none;
  if (live.finished) return T.status.done(her);
  return live.n ? T.status.step(her, live.n) : T.status.opened(her);
}

export async function runOwner(root, store, { base = location.origin + location.pathname } = {}) {
  // Firestore writes resolve only once the server acks, so never await them on the owner path (offline-first).
  if (!store.get().settings.ntfy) store.update((db) => (db.settings.ntfy = `mabalach-${newId(16)}`)).catch(() => {});
  const views = {};
  const stack = new ViewStack((v) => views[v]());
  const S = () => store.get().settings;

  // Toast when a new result lands live.
  let known = new Set(store.list("history").map((h) => h.id));
  store.subscribe((what) => {
    if (what === "history") {
      for (const h of store.list("history"))
        if (!known.has(h.id)) {
          if (h.src !== "local") (toast(T.newResult(S().her, h.fn)), confetti());
          known.add(h.id);
        }
    }
    if (["history", "live", "room"].includes(what) && ["home", "send", "history"].includes(stack.top)) views[stack.top]();
  });

  const back = html`<button class="btn btn-ghost back" data-on="back">${T.back}</button>`;
  const common = { back: () => stack.back(), go: (v) => (views[v] ? stack.push(v) : toast(T.soon)) };

  views.home = () => {
    const last = store.list("history")[0];
    const tiles = ["send", "local", "history", "picker", "brain", "places", "sweep", "settings"];
    render(root, html`
      <section class="card last">
        <div class="sub">${T.lastMeal}</div>
        ${last ? raw(html`<div class="big">${last.fe}</div><h2 class="title">${last.fn}</h2><div class="sub">${fmtDate(last.at)} · ${STR.modeLabel[last.m] ?? ""}</div>`) : raw(html`<p>${T.noMeals}</p>`)}
      </section>
      <p class="sub" data-testid="live">${liveStatus(store.doc("live", "quiz"), S().her)}</p>
      <div class="tiles">${tiles.map((k) => raw(html`<button class="btn tile${views[k] ? "" : " soon"}" data-on="go" data-arg="${k}"><span class="em">${T.tiles[k].e}</span>${T.tiles[k].t}</button>`))}</div>`, common);
  };

  views.send = () => {
    const s = S();
    const link = buildQuizLink(s.base || base, store.roomId);
    const text = `${T.sendText(s.her, s.me)}\n${link}`;
    render(root, html`${raw(back)}
      <h2 class="q">${T.sendTitle(s.her)}</h2>
      <a class="btn btn-primary" href="${waUrl(text, s.herPhone)}" target="_blank" rel="noopener">${T.whatsapp}</a>
      <button class="btn" data-on="copy">${T.copy}</button>
      <code class="link" dir="ltr">${link}</code>
      <p class="sub" data-testid="live" role="status">${liveStatus(store.doc("live", "quiz"), s.her)}</p>`, {
      ...common,
      copy: async () => toast((await copy(link)) ? T.copied : link),
    });
  };

  views.history = () => {
    const list = store.list("history");
    render(root, html`${raw(back)}
      <h2 class="q">${T.historyTitle}</h2>
      ${list.length ? "" : raw(html`<p class="sub">${T.noHistory}</p>`)}
      ${list.map((h) => raw(html`<article class="card hist">
        <div class="row"><span class="em">${h.fe}</span><b>${h.fn}</b><span class="sub">${fmtDate(h.at)}</span></div>
        <div class="sub">${STR.modeLabel[h.m] ?? ""}${h.price ? ` · ${"₪".repeat(h.price)}` : ""}</div>
        ${h.note ? raw(html`<p class="note">“${h.note}”</p>`) : ""}
        ${h.trail?.length ? raw(html`<details><summary>${T.trail}</summary><ol>${h.trail.map((t) => raw(html`<li>${t}</li>`))}</ol></details>`) : ""}
        <button class="btn btn-ghost" data-on="go" data-arg="picker">${T.pickPlace}</button>
      </article>`))}`, common);
  };

  // "She's next to me": the same quiz on this phone, saved straight to history.
  views.local = () => {
    render(root, html`${raw(back)}<div class="sub-root stack"></div>`, common);
    const inner = root.querySelector(".sub-root");
    startGuestQuiz(inner, {
      room: store.get(),
      history: store.list("history"),
      intro: false,
      onFinish: (out) =>
        finishForm(inner, out, T.localSend, async (form) => {
          const entry = resultEntry(out, form);
          store.put("history", newId(16), { ...entry, src: "local" }).catch(() => {});
          toast(T.saved);
          stack.reset("home");
        }),
    });
  };

  brainViews({ root, store, stack, views, back, common });
  stack.reset("home");
  return { stack, views };
}
