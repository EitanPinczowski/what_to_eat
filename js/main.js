// Boot: parse the hash → route.
import { currentRoute, clearHash } from "./router.js";
import { openStore, ownerRoomId } from "./store/open.js";
import { runGuest } from "./ui/guest/session.js";
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
  if (route.kind === "r") {
    // #r= fallback result from WhatsApp → import into the owner's room, then clear the hash.
    const store = await openStore(ownerRoomId(), { mode: route.mode });
    const { fresh } = await store.importResult(route.payload);
    clearHash();
    toast(fresh ? STR.imported : STR.importedOld);
  }
  // Owner home, sweep and join arrive in steps 2.4–3.2.
  render(root, html`<p class="sub">בקרוב 🍕</p>`);
}

boot().catch((e) => {
  console.error(e);
  fail(STR.errors.offline);
});
