// Tiny DOM helpers (PLAN.md §5.6). render() = innerHTML + click delegation via data-on / data-arg.
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

/** Tagged template: interpolations are escaped unless wrapped with raw(). */
export function html(strings, ...vals) {
  return strings.reduce((out, s, i) => {
    if (i === 0) return s;
    const v = vals[i - 1];
    const str = Array.isArray(v) ? v.map((x) => (x?.__raw ? x.s : esc(x))).join("") : v?.__raw ? v.s : esc(v);
    return out + str + s;
  }, "");
}
export const raw = (s) => ({ __raw: true, s: String(s) });

const bound = new WeakMap();

/**
 * render(root, markup, handlers): handlers[name](arg, event, el) runs for clicks on [data-on=name].
 * Also supports data-submit=name on forms (handler gets FormData).
 */
export function render(root, markup, handlers = {}) {
  root.innerHTML = markup;
  if (root.classList && root.offsetWidth !== undefined) {
    root.classList.remove("screen-in");
    void root.offsetWidth; // restart the enter animation on every new screen
    root.classList.add("screen-in");
  }
  bound.set(root, handlers);
  if (!root.__delegated) {
    root.__delegated = true;
    root.addEventListener("click", (e) => {
      if (e.__handled) return;
      const el = e.target.closest("[data-on]");
      if (!el || !root.contains(el) || el.disabled) return;
      const h = bound.get(root)?.[el.dataset.on];
      if (h) {
        e.preventDefault();
        e.__handled = true;
        h(el.dataset.arg, e, el);
      }
    });
    root.addEventListener("submit", (e) => {
      const f = e.target.closest("form[data-submit]");
      const h = f && bound.get(root)?.[f.dataset.submit];
      if (h) {
        e.preventDefault();
        if (e.__handled) return;
        e.__handled = true;
        h(new FormData(f), e, f);
      }
    });
    root.addEventListener("input", (e) => {
      const el = e.target.closest("[data-input]");
      const h = el && bound.get(root)?.[el.dataset.input];
      if (h) h(el.value, e, el);
    });
  }
  const focus = root.querySelector("[autofocus]") ?? root.querySelector("h2, .q");
  if (focus && !focus.hasAttribute("tabindex") && !focus.matches("input,button,textarea")) focus.setAttribute("tabindex", "-1");
  focus?.focus?.({ preventScroll: true });
}

export function toast(msg, ms = 2500) {
  const t = document.createElement("div");
  t.className = "toast";
  t.setAttribute("role", "status");
  t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.remove(), ms);
}

/** `.catch(saveFailed)` for fire-and-forget writes: never silent. The save marker toasts and logs; this keeps a console trace. */
export function saveFailed(e) {
  console.error("save failed", e);
}

/**
 * The save marker's behaviour, kept apart from the DOM so it can be tested. Wires store.onSave to:
 *   show(text|null)  "pending" text after `delay` ms of waiting, "saved" text for `hold` ms, then null
 *   fail(text)       a failed write (also logged once a minute to the error log, never for the log's own writes)
 */
export function saveStatus(store, { show, fail }, str, { delay = 600, hold = 1500, set = setTimeout, clear = clearTimeout } = {}) {
  let wait = null;
  let hide = null;
  let lastLog = 0;
  return store.onSave((e) => {
    clear(wait);
    wait = null;
    if (e.state === "pending") {
      clear(hide);
      wait = set(() => show(str.pending), delay);
    } else if (e.state === "saved") {
      show(str.saved);
      clear(hide);
      hide = set(() => show(null), hold);
    } else if (e.state === "error") {
      if (!e.pending) show(null);
      if (e.col === "errors") return console.error("error log failed", e.error); // the log itself: no toast, no loop
      fail(str.fail);
      const now = Date.now();
      if (e.col !== "feedback" && now - lastLog > 60000) {
        lastLog = now;
        store.logError({ msg: `save failed: ${String(e.error?.message ?? e.error).slice(0, 200)}`, screen: String(e.col) }).catch((x) => console.error("error log failed", x));
      }
    }
  });
}

/** Small marker in the corner of the page. Returns the unsubscribe. */
export function mountSaveStatus(store, str) {
  const el = document.createElement("div");
  el.className = "savemark";
  el.setAttribute("aria-live", "polite"); // no role=status: pages and tests treat that role as the one message of the screen
  el.hidden = true;
  document.body.append(el);
  return saveStatus(store, {
    show: (t) => ((el.hidden = !t), (el.textContent = t ?? "")),
    fail: (t) => toast(t),
  }, str);
}

export function confetti(n = 40) {
  if (matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const box = document.createElement("div");
  box.className = "confetti";
  box.setAttribute("aria-hidden", "true");
  const em = ["🎉", "✨", "🍕", "💛", "🎊"];
  for (let i = 0; i < n; i++) {
    const s = document.createElement("span");
    s.textContent = em[i % em.length];
    s.style.left = `${Math.random() * 100}%`;
    s.style.animationDelay = `${Math.random() * 0.6}s`;
    box.append(s);
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 2600);
}

export async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function share({ text, url }) {
  if (navigator.share) {
    try {
      await navigator.share({ text, url });
      return true;
    } catch {
      return false;
    }
  }
  return copy(url ? `${text} ${url}` : text);
}
