// Boot: parse the hash → route.
import { currentRoute, clearHash } from "./router.js";
import { openStore, ownerRoomId, adoptRoom, ROOM_KEY } from "./store/open.js";
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
  if (route.kind === "bad") return fail(STR.errors.badLink);
  // The screen's code loads while the store connects; the illustration list is only needed by the screens themselves.
  if (route.kind === "w") {
    const [mod] = await Promise.all([import("./ui/guest/wrapped.js"), pics]);
    return mod.runWrapped(root, route.payload);
  }
  if (route.kind === "q") {
    const [store, mod] = await Promise.all([openStore(route.room, { mode: route.mode }), import("./ui/guest/session.js"), pics]);
    if (guardMoved(store)) return;
    return mod.runGuest(root, store);
  }
  // A device that lost its saved room id gets it back from the second copy before any room is created or adopted.
  if (!localStorage.getItem(ROOM_KEY)) await import("./store/room-backup.js").then((m) => m.restoreRoom()).catch(() => {}); // harmless: no backup means a new room, as before
  if (route.kind === "join") {
    // Another of the owner's devices: adopt the room, then go home.
    // A different room already on this device is replaced only after a confirm (old id kept as a backup key).
    const res = adoptRoom(route.room, { ask: () => confirm(STR.joinAsk) });
    clearHash();
    if (res !== "same" && res !== "declined") toast(STR.joined);
  }
  if (route.kind === "s") {
    const [store, mod] = await Promise.all([openStore(route.room, { mode: route.mode }), import("./ui/guest/sweep.js"), pics]);
    if (guardMoved(store)) return;
    return mod.runSweep(root, store);
  }
  const roomId = ownerRoomId();
  import("./store/room-backup.js").then((m) => m.backupRoom()).catch(() => {}); // harmless: the backup is a second chance only
  const owner = import("./ui/owner/app.js");
  owner.catch(() => {}); // harmless: best effort
  const [store] = await Promise.all([openStore(roomId, { mode: route.mode, fast: route.kind !== "r" }), pics]);
  if (guardMoved(store)) return;
  if (route.kind === "r") {
    // #r= fallback result from WhatsApp → import into the owner's room, then clear the hash.
    // The link can be crafted by anyone: validate strictly, and only apply after a confirm.
    const chk = store.checkResult(route.payload);
    clearHash();
    if (chk.bad) toast(STR.importBad);
    else if (chk.dup) toast(STR.importedOld);
    else if (confirm(STR.importAsk(chk.clean))) {
      const { withTimeout } = await import("./ui/guest/session.js");
      const { fresh } = await withTimeout(store.importResult(route.payload), 4000).catch(() => ({ fresh: true }));
      toast(fresh ? STR.imported : STR.importedOld);
    }
  }
  return (await owner).runOwner(root, store, { mode: route.mode });
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
}).catch(() => {}); // harmless: best effort

// Android/desktop Chrome: keep the install prompt for the button in settings.
addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  globalThis.__installPrompt = e;
});

// A new link opened in this tab (hash-only navigation): boot again.
addEventListener("hashchange", () => location.hash && location.reload());
