// Boot: parse the hash → route.
import { currentRoute } from "./router.js";
import { openStore } from "./store/open.js";
import { startGuestQuiz } from "./ui/guest/quiz.js";
import { render, html } from "./ui/dom.js";
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
    return startGuestQuiz(root, { room: store.get(), history: store.list("history") });
  }
  // Owner home, sweep, join and #r= import arrive in steps 2.3–3.2.
  render(root, html`<p class="sub">בקרוב 🍕</p>`);
}

boot().catch((e) => {
  console.error(e);
  fail(STR.errors.offline);
});
