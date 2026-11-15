// Boot: parse the hash → route.
import { currentRoute, clearHash } from "./router.js";
import { openStore, ownerRoomId, adoptRoom } from "./store/open.js";
import { runGuest, withTimeout } from "./ui/guest/session.js";
import { runOwner } from "./ui/owner/app.js";
import { runSweep } from "./ui/guest/sweep.js";
import { runWrapped } from "./ui/guest/wrapped.js";
import { render, html, raw, toast } from "./ui/dom.js";
import { STR } from "./data/strings.js";
import { loadPics } from "./ui/pics.js";
import { registerSW } from "./pwa.js";

const root = document.getElementById("app");
const pics = loadPics();

function fail(msg, retry = false) {
  render(root, html`<div class="big" aria-hidden="true">🍽️</div><p class="sub" role="alert">${msg}</p>
    ${retry ? raw(html`<button class="btn btn-primary" data-on="retry">${STR.errors.retry}</button>`) : ""}`, { retry: () => location.reload() });
}

/** A room retired by "rotate key" shows a message instead of empty data, also when it happens while open. */
function guardMoved(store) {
  if (store.moved) return (fail(STR.errors.moved), true);
  store.subscribe((what) => what === "room" && store.moved && fail(STR.errors.moved));
  return false;
}

async function boot() {
  const route = currentRoute();
  render(root, html`<p class="sub">${STR.loading}</p>`);
  await pics;
  if (route.kind === "bad") return fail(STR.errors.badLink);
  if (route.kind === "w") return runWrapped(root, route.payload);
  if (route.kind === "q") {
    const store = await openStore(route.room, { mode: route.mode });
    if (guardMoved(store)) return;
    return runGuest(root, store);
  }
  if (route.kind === "join") {
    // Another of the owner's devices: adopt the room, then go home.
    // A different room already on this device is only replaced after a confirm (the old id is kept as a backup key).
    const res = adoptRoom(route.room, { ask: () => confirm(STR.joinAsk) });
    clearHash();
    if (res !== "same" && res !== "declined") toast(STR.joined);
  }
  if (route.kind === "s") {
    const store = await openStore(route.room, { mode: route.mode });
    if (guardMoved(store)) return;
    return runSweep(root, store);
  }
  const store = await openStore(ownerRoomId(), { mode: route.mode });
  if (guardMoved(store)) return;
  if (route.kind === "r") {
    // #r= fallback result from WhatsApp → import into the owner's room, then clear the hash.
    const { fresh } = await withTimeout(store.importResult(route.payload), 4000).catch(() => ({ fresh: true }));
    clearHash();
    toast(fresh ? STR.imported : STR.importedOld);
  }
  return runOwner(root, store, { mode: route.mode });
}

boot().catch((e) => {
  console.error(e);
  fail(STR.errors.offline, true);
});

// New version waiting → a small bar with "refresh" (never reloads by itself mid-quiz).
registerSW((apply) => {
  if (document.querySelector(".update-bar")) return;
  const bar = document.createElement("div");
  bar.className = "update-bar";
  bar.setAttribute("role", "status");
  bar.innerHTML = html`<span>${STR.update.text}</span><button class="btn btn-primary" data-k="yes">${STR.update.yes}</button><button class="btn btn-ghost" data-k="later">${STR.update.later}</button>`;
  bar.addEventListener("click", (e) => {
    const k = e.target.closest("button")?.dataset.k;
    if (k === "yes") apply();
    if (k) bar.remove();
  });
  document.body.append(bar);
}).catch(() => {});

// Android/desktop Chrome: keep the install prompt for the button in settings.
addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  globalThis.__installPrompt = e;
});

// A new link opened in this tab (hash-only navigation): boot again.
addEventListener("hashchange", () => location.hash && location.reload());
