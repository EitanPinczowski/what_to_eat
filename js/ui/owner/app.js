// Owner app: home + view stack (send quiz, she's-next-to-me, history). Later steps add brain, places, picker, settings.
import { STR } from "../../data/strings.js";
import { newId } from "../../share/codec.js";
import { buildQuizLink } from "../../share/links.js";
import { waUrl } from "../../share/whatsapp.js";
import { ViewStack } from "../../router.js";
import { render, html, raw, toast, copy, confetti } from "../dom.js";
import { statsFrom, nudgeExp } from "../../engine/learn.js";
import { QUESTIONS } from "../../data/questions.js";
import { isFirstOfMonth } from "../../engine/wrapped.js";
import { ACK_CODES } from "../../store/store.js";
import { backupDue } from "./backup-due.js";

const T = STR.owner;
const HOW_AFTER = 2 * 3600e3;
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

/** One-tap replies on the result card, shown once she has sent (tap again to clear). */
export function ackCard(live) {
  if (!live?.finished) return "";
  return html`<section class="card ackbar" data-testid="ackbar"><div class="sub">${STR.ack.title}</div>
    <div class="grid choose">${ACK_CODES.map((c) => raw(html`<button class="btn" data-on="ack" data-arg="${c}" aria-pressed="${live.ack === c}"><span class="em">${STR.ack[c].e}</span>${STR.ack[c].t}</button>`))}</div></section>`;
}

export async function runOwner(root, store, { base = location.origin + location.pathname, mode } = {}) {
  // Firestore writes resolve only once the server acks, so never await them on the owner path (offline-first).
  if (!store.get().settings.ntfy) store.update((db) => (db.settings.ntfy = `mabalach-${newId(16)}`)).catch(() => {});
  const views = {};
  const ctx = {};
  // Changing screen drops the picker's navigation card and stops a running roll (they must not come back after going back).
  const stack = new ViewStack((v) => ((ctx.navTo = null), (ctx.rollId = (ctx.rollId ?? 0) + 1), views[v]()));
  const S = () => store.get().settings;

  // Toast when a new result lands live.
  let known = new Set(store.list("history").map((h) => h.id));
  let collecting = false;
  const collect = () => {
    if (collecting) return;
    collecting = true;
    store.collectInbox().catch(() => {}).finally(() => (collecting = false));
  };
  collect();
  store.subscribe((what) => {
    if (what === "history") {
      collect();
      for (const h of store.list("history"))
        if (!known.has(h.id)) {
          if (h.src !== "local") (toast(T.newResult(S().her, h.fn)), confetti());
          known.add(h.id);
        }
    }
    if (["history", "live", "room"].includes(what) && ["home", "send", "history", "sweep"].includes(stack.top)) views[stack.top]();
  });

  const back = html`<button class="btn back" data-on="back">${T.back}</button>`;
  const common = {
    back: () => stack.back(),
    go: (v) => (v === "picker" && ((ctx.entryId = null), (ctx.pick = null)), views[v] ? stack.push(v) : toast(T.soon)),
    pickFor: (id) => ((ctx.entryId = id), (ctx.pick = null), stack.push("picker")),
  };

  // "How was it?" — ≥2 h after "✅ הולכים" (entry.goAt, set by the picker), one tap 👍/👎.
  const pendingHow = () => store.list("history").find((h) => h.goAt && h.how === undefined && Date.now() - new Date(h.goAt) >= HOW_AFTER);
  const howCard = () => {
    const h = pendingHow();
    return h
      ? html`<section class="card how" data-testid="how"><div>${T.how(h.fn)}</div>
          <div class="chips"><button class="chip" data-on="how" data-arg="${h.id}:1">👍</button><button class="chip" data-on="how" data-arg="${h.id}:0">👎</button></div></section>`
      : "";
  };
  const how = (arg) => {
    const [id, v] = arg.split(":");
    const h = store.doc("history", id);
    if (!h) return;
    const up = v === "1";
    store.put("history", id, { ...h, how: up ? 1 : -1 }).catch(() => {});
    if (h.f) store.update((db) => (db.exp = nudgeExp(db.exp ?? {}, h.f, up))).catch(() => {});
    if (h.place && store.doc("places", h.place)) {
      const p = store.doc("places", h.place);
      store.put("places", h.place, { ...p, rating: Math.max(0, Math.min(5, (p.rating ?? 3) + (up ? 0.5 : -0.5))) }).catch(() => {});
    }
    toast(T.thanks);
    views.home();
  };
  const statsCard = (list) => {
    const st = statsFrom(list);
    if (!st) return "";
    const q = QUESTIONS.find((x) => x.id === st.confusing);
    return html`<section class="card stats-card" data-testid="stats">
      <div>${T.stats.hit(Math.round(st.hitRate * 100))} · ${T.stats.steps(st.avgSteps.toFixed(1))} · ${T.stats.n(st.n)}</div>
      ${q ? raw(html`<div class="sub">${T.stats.confusing(q.text)}</div>`) : ""}</section>`;
  };

  views.home = () => {
    const last = store.list("history")[0];
    const tiles = ["send", "local", "history", "picker", "brain", "places", "sweep", "wrapped", "shopping", "settings"];
    render(root, html`
      <section class="card last">
        <div class="sub">${T.lastMeal}</div>
        ${last ? raw(html`<div class="big">${last.fe}</div><h2 class="title">${last.fn}</h2><div class="sub">${fmtDate(last.at)} · ${STR.modeLabel[last.m] ?? ""}</div>`) : raw(html`<p>${T.noMeals}</p>`)}
      </section>
      ${raw(ackCard(store.doc("live", "quiz")))}
      ${raw(howCard())}
      ${store.list("history").length && backupDue(S()) ? raw(html`<button class="card btn remind" data-on="go" data-arg="settings" data-testid="backup">💾 ${STR.settings.remind}</button>`) : ""}
      <p class="sub" data-testid="live">${liveStatus(store.doc("live", "quiz"), S().her)}</p>
      <div class="tiles">${tiles.map((k) => raw(html`<button class="btn tile${views[k] ? "" : " soon"}${k === "wrapped" && isFirstOfMonth() ? " hot" : ""}" data-on="go" data-arg="${k}"><span class="em">${T.tiles[k].e}</span>${T.tiles[k].t}${k === "wrapped" && isFirstOfMonth() ? raw(html`<small>${STR.wrapped.firstBadge}</small>`) : ""}</button>`))}</div>`, { ...common, how, ack: (c) => store.setAck(store.doc("live", "quiz")?.ack === c ? null : c).catch(() => {}) });
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
      ${raw(statsCard(list))}
      ${list.length ? "" : raw(html`<p class="sub">${T.noHistory}</p>`)}
      ${list.map((h) => raw(html`<article class="card hist">
        <div class="row"><span class="em">${h.fe}</span><b>${h.fn}</b><span class="sub">${fmtDate(h.at)}</span></div>
        <div class="sub">${STR.modeLabel[h.m] ?? ""}${h.price ? ` · ${"₪".repeat(h.price)}` : ""}</div>
        ${h.note ? raw(html`<p class="note">“${h.note}”</p>`) : ""}
        ${h.trail?.length ? raw(html`<details><summary>${T.trail}</summary><ol>${h.trail.map((t) => raw(html`<li>${t}</li>`))}</ol></details>`) : ""}
        <button class="btn btn-ghost" data-on="pickFor" data-arg="${h.id}">${T.pickPlace}</button>
      </article>`))}`, common);
  };

  // "She's next to me": the same quiz on this phone, saved straight to history.
  views.local = async () => {
    const [{ startGuestQuiz }, { finishForm, resultEntry }] = await Promise.all([import("../guest/quiz.js"), import("../guest/session.js")]);
    render(root, html`<div class="sub-root stack"></div>`, common);
    const inner = root.querySelector(".sub-root");
    startGuestQuiz(inner, {
      room: store.get(),
      history: store.list("history"),
      intro: false,
      onExit: () => stack.back(), // first question: her back bar leaves this view like the old owner button did
      onFinish: (out) =>
        finishForm(inner, out, T.localSend, async (form) => {
          const entry = resultEntry(out, form);
          out.seal?.();
          store.put("history", newId(16), { ...entry, src: "local" }).catch(() => {});
          toast(T.saved);
          stack.reset("home");
        }),
    });
  };

  // Screens load on first use (sw.js still precaches every file, so they work offline). A stub stands in for each
  // view a module defines; the real module overwrites all of them, then the tapped one runs.
  const lazy = (keys, load, make) => {
    let loading = null;
    const stubs = {};
    for (const k of keys)
      stubs[k] = async () => {
        try {
          loading ??= load().then((m) => make(m));
          await loading;
        } catch (e) {
          loading = null;
          console.error(e);
          return toast(T.soon);
        }
        if (views[k] !== stubs[k]) return views[k]();
      };
    Object.assign(views, stubs);
  };
  lazy(["brain", "food", "foodForm"], () => import("./brain.js"), (m) => m.brainViews({ root, store, stack, views, back, common }));
  lazy(["sweep"], () => import("./send-sweep.js"), (m) => m.sweepViews({ root, store, views, back, common, base }));
  lazy(["wrapped"], () => import("./send-wrapped.js"), (m) => m.wrappedViews({ root, store, views, back, common, base }));
  lazy(["places", "tryForm", "placeForm", "picker"], () => import("./places.js"), (m) => m.placesViews({ root, store, stack, views, back, common, ctx }));
  lazy(["recipe", "shopping"], () => import("./shopping.js"), (m) => m.shoppingViews({ root, store, stack, views, back, common, ctx }));
  lazy(["settings"], () => import("./settings.js"), (m) => m.settingsViews({ root, store, views, back, common, base, mode }));
  stack.reset("home");
  return { stack, views };
}
