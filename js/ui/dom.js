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
  bound.set(root, handlers);
  if (!root.__delegated) {
    root.__delegated = true;
    root.addEventListener("click", (e) => {
      const el = e.target.closest("[data-on]");
      if (!el || !root.contains(el) || el.disabled) return;
      const h = bound.get(root)?.[el.dataset.on];
      if (h) {
        e.preventDefault();
        h(el.dataset.arg, e, el);
      }
    });
    root.addEventListener("submit", (e) => {
      const f = e.target.closest("form[data-submit]");
      const h = f && bound.get(root)?.[f.dataset.submit];
      if (h) {
        e.preventDefault();
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
