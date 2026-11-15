// Owner: send the monthly "food wrapped" link (summary computed here from history, carried inside the link).
import { STR } from "../../data/strings.js";
import { buildWrappedLink } from "../../share/links.js";
import { waUrl } from "../../share/whatsapp.js";
import { wrappedSummary, prevMonth, isFirstOfMonth } from "../../engine/wrapped.js";
import { render, html, raw, toast, copy } from "../dom.js";

const W = STR.wrapped;

/** The summary for the previous month, with names added for the guest view. */
export function wrappedFor(store, now = new Date()) {
  const room = store.get();
  const places = Object.fromEntries(store.list("places").map((p) => [p.id, { name: p.name }]));
  const s = wrappedSummary(store.list("history"), prevMonth(now), places);
  return { ...s, her: room.settings.her, me: room.settings.me };
}

export function wrappedViews({ root, store, views, back, common, base }) {
  views.wrapped = () => {
    const s = wrappedFor(store);
    const st = store.get().settings;
    const month = W.month(s.mo);
    const link = buildWrappedLink(st.base || base, s);
    const text = `${W.sendText(st.her, st.me, month)}\n${link}`;
    render(root, html`${raw(back)}
      <h2 class="q">${W.ownerTitle(st.her)}</h2>
      <p class="sub">${W.ownerFor(month)} · ${W.ownerN(s.n)}</p>
      ${s.enough ? "" : raw(html`<p class="sub" data-testid="wr-few">${W.ownerFew}</p>`)}
      <a class="btn btn-primary" href="${waUrl(text, st.herPhone)}" target="_blank" rel="noopener">${STR.owner.whatsapp}</a>
      <button class="btn" data-on="copy">${STR.owner.copy}</button>
      <code class="link" dir="ltr">${link}</code>`, {
      ...common,
      copy: async () => toast((await copy(link)) ? STR.owner.copied : link),
    });
  };
}

export { isFirstOfMonth };
