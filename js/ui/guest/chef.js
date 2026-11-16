// The little chef: Fluent chef emoji beside the question, 4 CSS-transform states (idle, nod, drool, cheer). Lazy.
import { html, raw } from "../dom.js";
import { qPic } from "../pics.js";
import { PLAY } from "../../data/strings-play.js";

export const STATES = ["idle", "nod", "drool", "cheer"];
export const chefHtml = (s = "idle") => html`<span class="chef" data-state="${STATES.includes(s) ? s : "idle"}" data-testid="chef" role="img" aria-label="${PLAY.chef.alt}">${raw(qPic("🧑‍🍳"))}</span>`;

/** Put the chef in the quiz top bar; a nod settles back to idle. */
export function place(root, state = "idle") {
  const bar = root.querySelector?.(".qbar");
  if (!bar) return null;
  bar.querySelector(".chef")?.remove();
  bar.insertAdjacentHTML("beforeend", chefHtml(state));
  const el = bar.querySelector(".chef");
  el.addEventListener("animationend", () => el.dataset.state === "nod" && (el.dataset.state = "idle"));
  return el;
}
export const cheer = (root) => place(root, "cheer");
