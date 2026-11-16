// Owner: send the taste sweep (only unrated / everything) + live progress.
import { FOODS } from "../../data/foods.js";
import { STR } from "../../data/strings.js";
import { buildFoods } from "../../engine/foods.js";
import { buildSweepLink } from "../../share/links.js";
import { waUrl } from "../../share/whatsapp.js";
import { render, html, raw, toast, copy, saveFailed, topbar } from "../dom.js";
import { sweepOrder } from "../guest/sweep.js";

const W = STR.sweep;

export function sweepStatus(live, her) {
  if (!live?.at) return STR.owner.status.none;
  if (live.finished) return W.done(her);
  return W.status(her, live.i ?? 0, live.n ?? 0);
}

export function sweepViews({ root, store, views, common, base }) {
  views.sweep = () => {
    const db = store.get();
    const s = db.settings;
    const foods = buildFoods(FOODS, db.custom);
    const unrated = foods.filter((f) => !db.ratings[f.id]?.r).length;
    const link = buildSweepLink(s.base || base, store.roomId);
    const text = `${W.sendText(s.her, s.me)}\n${link}`;
    const live = store.doc("live", "sweep");
    render(root, html`${raw(topbar(W.ownerTitle(s.her)))}
      <div class="chips">
        <button class="chip" data-on="mode" data-arg="unrated" aria-pressed="${(live?.mode ?? "unrated") === "unrated"}">${W.onlyNew(unrated)}</button>
        <button class="chip" data-on="mode" data-arg="all" aria-pressed="${live?.mode === "all"}">${W.all}</button>
      </div>
      <button class="btn" data-on="copy">${STR.owner.copy}</button>
      <code class="link" dir="ltr">${link}</code>
      <p class="sub" data-testid="sweep-live" role="status">${sweepStatus(live, s.her)}</p>
      <a class="btn btn-primary act" href="${waUrl(text, s.herPhone)}" target="_blank" rel="noopener">${STR.owner.whatsapp}</a>`, {
      ...common,
      copy: async () => toast((await copy(link)) ? STR.owner.copied : link),
      // Choosing a mode resets the sweep so her next open starts a fresh deck.
      mode: (mode) => {
        const order = sweepOrder(foods, db.ratings, mode);
        store.put("live", "sweep", { mode, order, i: 0, skipped: [], given: {}, n: order.length, finished: false }).catch(saveFailed);
        views.sweep();
      },
    });
  };
}
