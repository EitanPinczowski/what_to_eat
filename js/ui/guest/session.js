// Guest session: live doc + resume, finish/send, ntfy ping, feedback, error log, #r= WhatsApp fallback.
import { notifyAll } from "../../push.js";
import { STR } from "../../data/strings.js";
import { newId } from "../../share/codec.js";
import { buildResultLink } from "../../share/links.js";
import { waUrl } from "../../share/whatsapp.js";
import { pic, catLabel, foodLabel } from "../pics.js";
import { render, html, raw, confetti } from "../dom.js";
import { startGuestQuiz } from "./quiz.js";
import { VOTE_NONE } from "../../store/store.js";
import { fetchWeather } from "../../weather.js";

const SEND_TIMEOUT = 8000;
const cut = (s, n) => String(s ?? "").slice(0, n);
const ua = () => cut(globalThis.navigator?.userAgent, 200);

export function withTimeout(p, ms) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
}

/** Minimal public ping (ntfy.sh is public: no food, no notes). */
export async function ping(topic, text, f = globalThis.fetch) {
  if (!topic) return false;
  try {
    await f(`https://ntfy.sh/${encodeURIComponent(topic)}`, { method: "POST", body: text });
    return true;
  } catch {
    return false;
  }
}

/** Crashes on her phone go to rooms/{id}/errors (max 10 per session). */
export function installErrorLog(store, screen, win = globalThis.window) {
  let left = 10;
  const log = (msg, stack) => {
    if (left-- <= 0) return;
    store.logError({ msg: cut(msg, 300), stack: cut(stack, 1500), screen: cut(screen(), 40), ua: ua() }).catch(() => {});
  };
  win?.addEventListener("error", (e) => log(e.message, e.error?.stack));
  win?.addEventListener("unhandledrejection", (e) => log(e.reason?.message ?? e.reason, e.reason?.stack));
}

/** Build the history entry + #r= payload for a finished quiz. */
export function resultEntry(out, form, at = new Date().toISOString()) {
  const { result, food, trail, top } = out;
  return {
    at,
    f: food?.id ?? null,
    fn: cut(food?.name ?? result.free, 80),
    fe: food?.emoji ?? "🍽️",
    m: form.m ?? "any",
    price: form.price ?? null,
    note: cut(form.note, 300),
    trail: trail.slice(-40).map((s) => cut(s, 120)),
    top: (top ?? []).slice(0, 5),
    ...(out.ans ? { ans: out.ans.slice(0, 30).map(([q, i]) => `${q}:${i}`) } : {}), // Firestore: no nested arrays
    ...(out.stats ? { stats: out.stats } : {}),
  };
}

/** Result + how / budget / note form. onSend(form) runs once when the button is tapped. */
export function finishForm(root, out, sendLabel, onSend) {
  const form = { m: null, price: null, note: "" };
  const handlers = {
    mode: (m) => ((form.m = form.m === m ? null : m), draw()),
    price: (p) => ((form.price = form.price === Number(p) ? null : Number(p)), draw()),
    note: (v) => (form.note = v),
    send: async (_a, _e, btn) => {
      btn.disabled = true;
      btn.textContent = STR.result.sending;
      await onSend({ ...form });
    },
  };
  const draw = () =>
    render(root, html`<div class="mood">${out.mood}</div>
      <div class="big reveal" aria-hidden="true">${raw(pic(out.food))}</div>
      <h2 class="title">${out.food?.name ?? out.result.free}</h2>${out.food ? raw(html`<p class="cat">${catLabel(out.food)}</p>`) : ""}
      <p class="sub">${STR.result.how}</p>
      <div class="grid choose">${STR.result.modes.map((x) => raw(html`<button class="btn" data-on="mode" data-arg="${x.m}" aria-pressed="${form.m === x.m}"><span class="em">${x.e}</span>${x.t}</button>`))}</div>
      <p class="sub">${STR.result.budget}</p>
      <div class="grid choose">${STR.result.prices.map((t, i) => raw(html`<button class="btn" data-on="price" data-arg="${i + 1}" aria-pressed="${form.price === i + 1}">${t}</button>`))}</div>
      <textarea name="note" rows="2" maxlength="300" placeholder="${STR.result.note}" data-input="note">${form.note}</textarea>
      <button class="btn btn-primary" data-on="send">${sendLabel}</button>`, handlers);
  draw();
}

export async function runGuest(root, store, { base = location.origin + location.pathname } = {}) {
  const room = store.get();
  const s = room.settings;
  let screen = "intro";
  installErrorLog(store, () => screen);

  const live = store.doc("live", "quiz");
  const saveLive = (data) => store.put("live", "quiz", { ...data, at: new Date().toISOString() }).catch(() => {});

  const feedback = (back) => {
    const prev = screen;
    screen = "feedback";
    render(root, html`<h2 class="q">${STR.feedback.text}</h2>
      <form data-submit="send" class="stack">
        <textarea name="t" rows="4" maxlength="500" placeholder="${STR.feedback.placeholder}" autofocus></textarea>
        <button class="btn btn-primary" type="submit">${STR.feedback.send}</button>
      </form>
      <button class="btn back" data-on="back">${STR.feedback.back}</button>`, {
      send: async (fd) => {
        const t = cut(fd.get("t"), 500).trim();
        if (t) await withTimeout(store.put("feedback", newId(12), { at: new Date().toISOString(), text: t, screen: prev, ua: ua() }), 4000).catch(() => {});
        render(root, html`<p class="sub" role="status">${STR.feedback.thanks}</p>
          <button class="btn" data-on="back" autofocus>${STR.feedback.back}</button>`, { back: () => ((screen = prev), back()) });
      },
      back: () => ((screen = prev), back()),
    });
  };

  const start = async (actions) => {
    screen = actions?.length ? "quiz" : "intro";
    const opened = live?.opened && actions ? live.opened : new Date().toISOString();
    saveLive({ opened, n: actions?.length ?? 0, actions: actions ?? [], trail: [], finished: false });
    const weather = actions?.length ? null : await Promise.race([fetchWeather(room.settings?.city), new Promise((r) => setTimeout(() => r(null), 3500))]).catch(() => null);
    startGuestQuiz(root, {
      weather,
      room,
      history: store.list("history"),
      actions,
      onFeedback: feedback,
      onProgress: (p) => {
        screen = `q${p.n}`;
        saveLive({ opened, n: p.n, actions: p.actions, trail: p.trail.slice(-40), finished: false });
      },
      onFinish: (out) => finishScreen(out, opened),
    });
  };

  const finishScreen = (out, opened) => {
    screen = "finish";
    finishForm(root, out, STR.result.send(s.me), async (form) => {
        const id = newId(16);
        const entry = resultEntry(out, form);
        try {
          await withTimeout(
            Promise.all([
              store.put("history", id, { ...entry, src: "live" }),
              store.put("live", "quiz", { opened, n: out.trail.length, actions: [], trail: entry.trail, finished: true, resultId: id, at: entry.at }),
            ]),
            SEND_TIMEOUT,
          );
          ping(s.ntfy, STR.ntfy(s.her));
          notifyAll(s, "quiz");
          sent();
        } catch {
          fallback({ t: "quiz", id, ...entry });
        }
    });
  };

  const sent = () => {
    screen = "sent";
    confetti();
    render(root, html`<div class="big reveal" aria-hidden="true">💌</div>
      <h2 class="title" role="status">${STR.result.sent(s.me)}</h2>
      <p class="sub">${STR.result.sentSub}</p>
      <p class="sub ack" data-testid="ack" role="status" aria-live="polite"></p>
      <section data-testid="vote"></section>`);
    watchAck();
    watchVote();
  };

  // Eitan's reply lands in the same live doc; update the line in place (no re-render, no repeat confetti).
  let unAck = null;
  const showAck = (code) => {
    const el = root.querySelector?.("[data-testid=ack]");
    const line = STR.ack[code]?.line;
    if (!el || !line || el.textContent === line) return;
    el.textContent = line;
    el.classList.remove("ack-in");
    void el.offsetWidth; // restart the pop animation (CSS disables it under prefers-reduced-motion)
    el.classList.add("ack-in");
  };
  const watchAck = () => {
    unAck?.();
    showAck(store.doc("live", "quiz")?.ack);
    unAck = store.subscribe((what) => what === "live" && screen === "sent" && showAck(store.doc("live", "quiz")?.ack));
  };

  // Eitan's place vote (live/vote): drawn into its own section so the rest of the screen stays put.
  let unVote = null;
  const drawVote = () => {
    const el = root.querySelector?.("[data-testid=vote]");
    const v = store.vote();
    if (!el) return;
    if (!v) return void (el.innerHTML = "");
    const opts = v.ids.map((id, i) => html`<button class="btn" data-on="vote" data-arg="${id}" aria-pressed="${v.pick === id}">${v.names[i] ?? ""}</button>`);
    const none = html`<button class="btn btn-ghost" data-on="vote" data-arg="${VOTE_NONE}" aria-pressed="${v.pick === VOTE_NONE}">${STR.vote.neither}</button>`;
    const name = v.names[v.ids.indexOf(v.pick)] ?? "";
    const line = v.pick === VOTE_NONE ? STR.vote.pickedNone : v.pick ? STR.vote.picked(name) : STR.vote.sub;
    el.innerHTML = html`<h3 class="q">${STR.vote.title}</h3><p class="sub" role="status" aria-live="polite">${line}</p>
      <div class="stack">${raw(opts.join(""))}${raw(none)}</div>`;
  };
  const watchVote = () => {
    unVote?.();
    drawVote();
    unVote = store.subscribe((what) => what === "live" && (screen === "sent" || screen === "already") && drawVote());
    const sec = root.querySelector?.("[data-testid=vote]");
    if (sec && !sec.__vote) {
      sec.__vote = true;
      sec.addEventListener?.("click", (e) => {
        const b = e.target.closest?.("[data-on=vote]");
        const code = b?.dataset.arg;
        if (!code || !(code === VOTE_NONE || store.vote()?.ids.includes(code))) return;
        store.castVote(code).catch(() => {}); // local copy updates synchronously; the write may wait on the network
        ping(s.ntfy, STR.vote.ntfy(s.her));
        notifyAll(s, "vote");
      });
    }
  };

  const fallback = (payload) => {
    screen = "fallback";
    const link = buildResultLink(base, payload);
    const url = waUrl(`${STR.result.waText(payload.fn)}\n${link}`, s.myPhone);
    render(root, html`<p class="sub" role="alert">${STR.result.failed}</p>
      <a class="btn btn-primary" href="${url}" target="_blank" rel="noopener">${STR.result.wa}</a>`);
  };

  if (live?.finished) {
    screen = "already";
    render(root, html`<div class="big" aria-hidden="true">💌</div>
      <h2 class="title">${STR.result.already(s.me)}</h2>
      <section data-testid="vote"></section>
      <button class="btn btn-primary" data-on="again" autofocus>${STR.result.again}</button>`, { again: () => start(null) });
    watchVote();
  } else start(live?.actions?.length ? live.actions : null);
}
