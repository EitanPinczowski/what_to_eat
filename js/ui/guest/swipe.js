// Swipe for two-choice screens (W4b). Lazy: loaded with her first 2-choice question. Same idea as the sweep's swipe:
// a pointer drag past SWIPE px picks a side; anything shorter is a normal tap and the click goes through untouched.
import { STR } from "../../data/strings.js";

export const SWIPE = 70; // px, as in sweep.js
const HINT_KEY = "wte-swipe-hint";

/** Which side a drag chose: right -> first, left -> second, a short drag -> null. */
export const side = (dx, min = SWIPE) => (Math.abs(dx) < min ? null : dx > 0 ? 0 : 1);

const seen = () => { try { return !!globalThis.localStorage?.getItem(HINT_KEY); } catch { return false; } };
const markSeen = () => { try { globalThis.localStorage?.setItem(HINT_KEY, "1"); } catch { /* harmless: the hint shows once more */ } };

/** attachSwipe(el, buttons): buttons are the two choice buttons (first = right). A swipe clicks the matching one. */
export function attachSwipe(el, buttons, { hint = true } = {}) {
  if (!el || buttons.length !== 2) return;
  let x0 = null;
  el.style.touchAction = "pan-y";
  el.addEventListener("pointerdown", (e) => (x0 = e.clientX));
  el.addEventListener("pointercancel", () => (x0 = null));
  el.addEventListener("pointerup", (e) => {
    const s = x0 === null ? null : side(e.clientX - x0);
    x0 = null;
    if (s === null) return;
    // the browser still fires a click on the element under the pointer: swallow that one, then click the chosen side
    const eat = (c) => (c.stopPropagation(), c.preventDefault());
    el.addEventListener("click", eat, true);
    setTimeout(() => el.removeEventListener("click", eat, true), 60);
    setTimeout(() => buttons[s].click(), 70);
  });
  if (hint && !seen()) {
    const p = document.createElement("p");
    p.className = "sub swipe-hint";
    p.setAttribute("data-testid", "swipe-hint");
    p.textContent = STR.swipeHint;
    el.append(p);
    markSeen();
  }
}
