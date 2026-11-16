// Owner app: home + view stack.
import { recentQuizEntry } from "./recent.js";
import { STR } from "../../data/strings.js";
import { newId } from "../../share/codec.js";
import { buildQuizLink } from "../../share/links.js";
import { waUrl } from "../../share/whatsapp.js";
import { ViewStack } from "../../router.js";
import { render, html, raw, toast, copy, confetti, saveFailed, mountSaveStatus, topbar } from "../dom.js";
import { nudgeExp } from "../../engine/learn.js";
import { isFirstOfMonth } from "../../engine/wrapped.js";
import { ACK_CODES, LOGS, LOG_KEEP } from "../../store/store.js";
import { backupDue } from "./backup-due.js";
import { pic } from "../pics.js";
import { liveLine, freshLive } from "./live-status.js";

const T = STR.owner;
const HOME_TILES = ["local", "picker", "shopping"];
const LAZY = "./insights.js"; // lazy, not precached (REVIEW 31)
const MORE_TILES = ["send", "history", "brain", "places", "sweep", "wrapped", "insights", "settings"];
const HOW_AFTER = 2 * 3600e3;
/** Live status line for the guest's quiz (from rooms/{id}/live/quiz). */
export function liveStatus(live, her) {
  if (!live?.opened) return T.status.none;
  if (live.finished) return T.status.done(her);
  return live.n ? T.status.step(her, live.n) : T.status.opened(her);
}

/** One-tap replies on the result card, shown once she has sent (tap again to clear). */
export function ackCard(live) {
  if (!live?.finished) return "";
  return html`<div class="ackbar" data-testid="ackbar"><div class="sub">${STR.ack.title}</div>
    <div class="grid choose">${ACK_CODES.map((c) => raw(html`<button class="btn" data-on="ack" data-arg="${c}" aria-pressed="${live.ack === c}"><span class="em">${STR.ack[c].e}</span>${STR.ack[c].t}</button>`))}</div></div>`;
}

/** "Notification sent ✓ / not sent ✗" from the receipt she wrote after her send (live/quiz.push). */
export function receiptLine(live) {
  if (!live?.finished || !live.push || typeof live.push.ok !== "boolean") return "";
  return live.push.ok ? T.receipt.ok : T.receipt.fail;
}

export async function runOwner(root, store, { base = location.origin + location.pathname, mode } = {}) {
  mountSaveStatus(store, STR.save);
  // never await writes on the owner path (offline-first)
  if (!store.get().settings.ntfy) store.update((db) => (db.settings.ntfy = `mabalach-${newId(16)}`)).catch(saveFailed);
  // notifications repair themselves after first paint
  const repair = () => import("../../push.js").then((m) => m.repairOnStart(store)).catch(saveFailed);
  repair();
  globalThis.navigator?.serviceWorker?.addEventListener?.("message", (e) => e.data?.type === "wte-sub-changed" && repair());
  // keep the logs at the newest 200
  if (LOGS.some((c) => store.list(c).length > LOG_KEEP)) store.trimLogs().catch(() => {}); // harmless: retried next start
  const views = {};
  const ctx = {};
  // changing screen drops the picker's nav card and stops a roll
  const stack = new ViewStack((v) => ((ctx.navTo = null), (ctx.rollId = (ctx.rollId ?? 0) + 1), views[v]()));
  const S = () => store.get().settings;

  // Toast when a new result lands live.
  let known = new Set(store.list("history").map((h) => h.id));
  let collecting = false;
  const collect = () => {
    if (collecting) return;
    collecting = true;
    store.collectInbox().catch(saveFailed).finally(() => (collecting = false));
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

  const common = {
    back: () => stack.back(),
    go: (v) => (v === "picker" && ((ctx.entryId = recentQuizEntry(store.list("history"))?.id ?? null), (ctx.pick = null)), views[v] ? stack.push(v) : toast(T.soon)),
    pickFor: (id) => ((ctx.entryId = id), (ctx.pick = null), stack.push("picker")),
  };

  // "how was it?": 2 h after "going" (goAt), one tap
  const pendingHow = () => store.list("history").find((h) => h.goAt && h.how === undefined && Date.now() - new Date(h.goAt) >= HOW_AFTER);
  const howCard = () => {
    const h = pendingHow();
    return h
      ? html`<div class="how" data-testid="how"><div>${T.how(h.fn)}</div>
          <div class="chips"><button class="chip" data-on="how" data-arg="${h.id}:1">👍</button><button class="chip" data-on="how" data-arg="${h.id}:0">👎</button></div></div>`
      : "";
  };
  const how = (arg) => {
    const [id, v] = arg.split(":");
    const h = store.doc("history", id);
    if (!h) return;
    const up = v === "1";
    store.put("history", id, { ...h, how: up ? 1 : -1 }).catch(saveFailed);
    if (h.f) store.update((db) => (db.exp = nudgeExp(db.exp ?? {}, h.f, up))).catch(saveFailed);
    if (h.place && store.doc("places", h.place)) {
      const p = store.doc("places", h.place);
      store.put("places", h.place, { ...p, rating: Math.max(0, Math.min(5, (p.rating ?? 3) + (up ? 0.5 : -0.5))) }).catch(saveFailed);
    }
    toast(T.thanks);
    views.home();
  };
  // One status card follows the quiz: send -> she's answering -> her result -> how was it.
  const tile = (k) => {
    const hot = k === "wrapped" && isFirstOfMonth();
    return html`<button class="btn tile${hot ? " hot" : ""}" data-on="go" data-arg="${k}"><span class="em">${T.tiles[k].e}</span>${T.tiles[k].t}${hot ? raw(html`<small>${STR.wrapped.firstBadge}</small>`) : ""}</button>`;
  };
  views.home = () => {
    const live = store.doc("live", "quiz"), her = S().her, hist = store.list("history");
    const e = recentQuizEntry(hist), busy = live?.opened && !live.finished && !(e && e.at >= live.opened);
    const r = busy ? null : (e ?? hist[0]);
    render(root, html`
      <section class="card last" data-testid="status">
        ${r ? raw(html`<div class="big">${raw(pic({ id: r.f, emoji: r.fe, name: r.fn }))}</div><h2 class="title">${r.fn}</h2>`) : ""}
        <p class="sub" data-testid="live">${liveLine(live, her)}</p>
        ${receiptLine(live) ? raw(html`<p class="sub" data-testid="receipt">${receiptLine(live)}</p>`) : ""}
        ${raw(ackCard(live))}
        ${e ? raw(html`<button class="btn btn-primary" data-on="pickFor" data-arg="${e.id}">${T.pickPlace}</button>`) : ""}
        ${busy || e ? "" : raw(html`<button class="btn btn-primary" data-on="go" data-arg="send">${T.tiles.send.e} ${T.tiles.send.t}</button>`)}
        ${busy ? "" : raw(howCard())}
      </section>
      ${hist.length && backupDue(S()) ? raw(html`<button class="card btn remind" data-on="go" data-arg="settings" data-testid="backup">💾 ${STR.settings.remind}</button>`) : ""}
      <div class="tiles">${HOME_TILES.map((k) => raw(tile(k)))}</div>
      <button class="btn more${isFirstOfMonth() ? " hot" : ""}" data-on="go" data-arg="more">${T.more}</button>`, { ...common, how, ack: (c) => store.setAck(live?.ack === c ? null : c).catch(saveFailed) });
  };
  views.more = () =>
    render(root, html`${raw(topbar(T.more))}<div class="tiles">${MORE_TILES.map((k) => raw(tile(k)))}</div>`, common);

  // sending a link starts a fresh run: her old status is cleared (item 8)
  const markSent = () => {
    const fresh = freshLive(store.doc("live", "quiz"));
    if (fresh) store.put("live", "quiz", fresh).catch(saveFailed);
  };

  // the relative time keeps counting (text only)
  setInterval(() => {
    const el = root.querySelector?.("[data-testid=live]");
    if (el && ["home", "send"].includes(stack.top)) el.textContent = liveLine(store.doc("live", "quiz"), S().her);
  }, 60e3);

  views.send = () => {
    const s = S();
    const link = buildQuizLink(s.base || base, store.roomId);
    const text = `${T.sendText(s.her, s.me)}\n${link}`;
    render(root, html`${raw(topbar(T.sendTitle(s.her)))}
      <button class="btn" data-on="copy">${T.copy}</button>
      <code class="link" dir="ltr">${link}</code>
      <p class="sub" data-testid="live" role="status">${liveLine(store.doc("live", "quiz"), s.her)}</p>
      <a class="btn btn-primary act" href="${waUrl(text, s.herPhone)}" target="_blank" rel="noopener" data-testid="wa-send">${T.whatsapp}</a>`, {
      ...common,
      copy: async () => (markSent(), toast((await copy(link)) ? T.copied : link)),
    });
    root.querySelector?.("[data-testid=wa-send]")?.addEventListener("click", () => setTimeout(markSent, 300));
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
      onExit: () => stack.back(),
      onFinish: (out) =>
        finishForm(inner, out, T.localSend, async (form) => {
          const entry = resultEntry(out, form);
          out.seal?.();
          store.put("history", newId(16), { ...entry, src: "local" }).catch(saveFailed);
          toast(T.saved);
          stack.reset("home");
        }),
    });
  };

  // screens load on first use; a stub per view, the module overwrites them
  const lazy = (keys, load, make) => {
    let loading = null;
    const stubs = {};
    for (const k of keys)
      stubs[k] = async (...args) => {
        const top = stack.top;
        try {
          loading ??= load().then((m) => make(m));
          await loading;
        } catch (e) {
          loading = null;
          console.error(e);
          return toast(T.soon);
        }
        if (stack.top !== top) return;
        if (views[k] !== stubs[k]) return views[k](...args);
      };
    Object.assign(views, stubs);
  };
  lazy(["brain", "food", "foodForm"], () => import("./brain.js"), (m) => m.brainViews({ root, store, stack, views, common }));
  lazy(["history"], () => import("./history.js"), (m) => m.historyViews({ root, store, views, common }));
  lazy(["sweep"], () => import("./send-sweep.js"), (m) => m.sweepViews({ root, store, views, common, base }));
  lazy(["wrapped"], () => import("./send-wrapped.js"), (m) => m.wrappedViews({ root, store, views, common, base }));
  lazy(["places", "tryForm", "placeForm", "picker"], () => import("./places.js"), (m) => m.placesViews({ root, store, stack, views, common, ctx }));
  lazy(["recipe", "shopping"], () => import("./shopping.js"), (m) => m.shoppingViews({ root, store, stack, views, common, ctx }));
  lazy(["insights"], () => import(LAZY), (m) => m.insightsViews({ root, store, views, common }));
  lazy(["settings"], () => import("./settings.js"), (m) => m.settingsViews({ root, store, views, common, base, mode }));
  stack.reset("home");
  return { stack, views };
}
