// Eitan's side of couple mode (lazy): the "גם אני עונה" toggle on the send screen and his answers (buttons), saved in live/couple.
import { html, raw } from "../dom.js";
import { COUPLE } from "../../data/strings-couple.js";
import { HIS_QS, parseHis } from "../../engine/couple.js";

const save = (store, his) => store.put("live", "couple", { his, at: new Date().toISOString() });

let forced = false; // toggle switched on before his first answer (the send screen redraws on every live change, so this lives here)

/** Draws the toggle into `host`. The saved live/couple doc is the state: his answers stay shown (and on) until he switches the toggle off. */
export function mountCouple(host, store, saveFailed = () => {}) {
  if (!host) return;
  const mine = () => parseHis(store.doc("live", "couple")?.his).map(([q, i]) => `${q}:${i}`);
  let on = forced || mine().length > 0, his = mine();
  const draw = () => {
    host.innerHTML = html`<button class="btn" data-testid="couple-toggle" aria-pressed="${on}">${COUPLE.toggle}</button>
      ${on ? raw(HIS_QS.map((id) => html`<div class="stack" data-testid="couple-q"><p class="sub">${COUPLE.qs[id].t}</p>
        <div class="chips">${raw(COUPLE.qs[id].a.map(([e, t], i) => html`<button class="btn" data-q="${id}" data-i="${i}" aria-pressed="${his.includes(`${id}:${i}`)}">${e} ${t}</button>`).join(""))}</div></div>`).join("")) : ""}
      <p class="sub">${on ? COUPLE.hidden : COUPLE.hint}</p>`;
  };
  host.addEventListener("click", (e) => {
    const b = e.target.closest?.("button");
    if (!b) return;
    if (b.dataset.testid === "couple-toggle") {
      on = forced = !on;
      if (!on) ((his = []), save(store, []).catch(saveFailed));
    } else if (b.dataset.q) {
      his = [...his.filter((s) => !s.startsWith(`${b.dataset.q}:`)), `${b.dataset.q}:${b.dataset.i}`];
      save(store, his).catch(saveFailed);
    }
    draw();
  });
  draw();
}
