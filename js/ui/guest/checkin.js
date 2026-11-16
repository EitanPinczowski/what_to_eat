// Next-day check-in (lazy): her opt-in question after she chooses, and the "how was it?" screen the notification opens.
import { CHECKIN as C } from "../../data/strings-checkin.js";
import { render, html, saveFailed } from "../dom.js";
import { clearHash } from "../../router.js";

export const ROOM_LOCAL = "wte.guestRoom";

/** Israel calendar date (YYYY-MM-DD) of the day after `now`. */
export function checkinAt(now = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" });
  const [y, m, d] = fmt.format(now).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** Whether to ask at all: a seed food the relay accepts, and notifications neither refused nor unsupported. */
export function canOffer(food, support) {
  return !!food && support !== "unsupported" && support !== "blocked";
}

/** The relay body for POST /api/schedule. */
export const scheduleBody = (sub, food, at) => ({ sub: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, food, at });

/** She tapped yes: subscribe this device (inside her tap) and schedule. Resolves "ok" | "denied" | "fail". */
export async function acceptCheckin(food, deps = {}) {
  const push = deps.push ?? (await import("../../push.js"));
  let sub;
  try {
    sub = await push.subscribeThisDevice();
  } catch (e) {
    return e?.message === "denied" ? "denied" : "fail";
  }
  const code = await push.postSigned(push.SCHEDULE_URL, scheduleBody(sub, food, checkinAt(deps.now)), deps.fetch);
  if (code < 200 || code >= 300) return "fail";
  try {
    localStorage.setItem(ROOM_LOCAL, push.boundRoomId());
  } catch {
    /* harmless: without it the tap just opens the home screen */
  }
  return "ok";
}

/** Draw the question into `el` (nothing happens until she taps). */
export async function mountCheckin(el, food, deps = {}) {
  if (!el) return;
  const push = deps.push ?? (await import("../../push.js"));
  const id = push.pushFood(food);
  if (!canOffer(id, push.pushSupport())) return;
  el.innerHTML = html`<p class="sub">${C.ask}</p><div class="grid choose"><button class="btn" data-k="yes" data-testid="checkin-yes">${C.yes}</button><button class="btn btn-ghost" data-k="no" data-testid="checkin-no">${C.no}</button></div>`;
  el.addEventListener("click", async (e) => {
    const k = e.target.closest?.("[data-k]")?.dataset.k;
    if (!k) return;
    if (k === "no") return void (el.innerHTML = "");
    el.innerHTML = "";
    const r = await acceptCheckin(id, { ...deps, push });
    el.innerHTML = html`<p class="sub" role="status" data-testid="checkin-result">${r === "ok" ? C.ok : r === "denied" ? C.denied : C.fail}</p>`;
  });
}

/** The screen a check-in notification opens (#how): rate her latest meal. */
export function runHow(root, store) {
  const h = store.list("history").filter((x) => x.src === "live" && x.how === undefined && x.fn).sort((a, b) => String(b.at).localeCompare(String(a.at)))[0];
  if (!h) return render(root, html`<p class="sub">${C.none}</p>`);
  render(root, html`<h2 class="q" data-testid="how-q">${C.how(h.fn)}</h2>
    <div class="grid choose"><button class="btn" data-on="how" data-arg="1">${C.up}</button><button class="btn" data-on="how" data-arg="-1">${C.down}</button></div>`, {
    how: (v) => {
      store.put("history", h.id, { ...h, how: Number(v) }).catch(saveFailed);
      render(root, html`<div class="big" aria-hidden="true">💌</div><p class="sub" role="status">${C.thanks}</p>`);
    },
  });
}

/** Boot route #how: open her room (saved when she opted in) and show the screen. true when handled. */
export async function bootHow(root, openStore, pics, guardMoved) {
  const room = localStorage.getItem(ROOM_LOCAL);
  if (!room) return clearHash(), false;
  const [store] = await Promise.all([openStore(room), pics]);
  if (!guardMoved(store)) runHow(root, store);
  return true;
}
