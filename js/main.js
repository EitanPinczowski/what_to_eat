// Boot: parse the hash → route.
import { currentRoute, clearHash } from "./router.js";
import { openStore, ownerRoomId, ROOM_KEY } from "./store/open.js";
import { runGuest, withTimeout } from "./ui/guest/session.js";
import { runOwner } from "./ui/owner/app.js";
import { render, html, toast } from "./ui/dom.js";
import { STR } from "./data/strings.js";

const root = document.getElementById("app");

function fail(msg) {
  render(root, html`<p class="sub" role="alert">${msg}</p>`);
}

async function boot() {
  const route = currentRoute();
  render(root, html`<p class="sub">${STR.loading}</p>`);
  if (route.kind === "bad") return fail(STR.errors.badLink);
  if (route.kind === "q") {
    const store = await openStore(route.room, { mode: route.mode });
    return runGuest(root, store);
  }
  if (route.kind === "join") {
    // Another of the owner's devices: adopt the room, then go home.
    localStorage.setItem(ROOM_KEY, route.room);
    clearHash();
    toast(STR.joined);
  }
  if (route.kind === "s") return fail(STR.owner.soon);
  const store = await openStore(ownerRoomId(), { mode: route.mode });
  if (route.kind === "r") {
    // #r= fallback result from WhatsApp → import into the owner's room, then clear the hash.
    const { fresh } = await withTimeout(store.importResult(route.payload), 4000).catch(() => ({ fresh: true }));
    clearHash();
    toast(fresh ? STR.imported : STR.importedOld);
  }
  return runOwner(root, store);
}

boot().catch((e) => {
  console.error(e);
  fail(STR.errors.offline);
});

// A new link opened in this tab (hash-only navigation): boot again.
addEventListener("hashchange", () => location.hash && location.reload());
