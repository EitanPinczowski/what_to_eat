// Fridge magnets: tap 2 of 6 feeling words onto the fridge door; the confirm is [data-on=ans] "i,j" (a pair, 0.6x each). Lazy; buttons stay if it fails.
import { html, raw } from "../../dom.js";
import { qPic } from "../../pics.js";
import { PLAY } from "../../../data/strings-play.js";

export function mount(host, q, order) {
  const M = PLAY.magnets;
  host.innerHTML = html`<div class="magnets" data-testid="magnets"><p class="sub">${M.hint}</p><div class="fridge" aria-label="${M.door}"><div class="door"></div></div>
    <div class="tray">${order.map((i) => raw(html`<button type="button" class="btn magnet" data-i="${i}" aria-pressed="false"><span class="em">${raw(qPic(q.answers[i].e))}</span>${q.answers[i].t}</button>`))}</div>
    <button class="btn btn-primary" data-on="ans" data-arg="" disabled>${M.done}</button></div>`;
  const door = host.querySelector(".door"), tray = host.querySelector(".tray"), go = host.querySelector(".btn-primary"), on = [];
  host.addEventListener("click", (e) => {
    const b = e.target.closest?.(".magnet");
    if (!b) return;
    const i = Number(b.dataset.i), at = on.indexOf(i);
    at >= 0 ? on.splice(at, 1) : (on.length > 1 && on.shift(), on.push(i)); // a third tap drops the oldest
    go.disabled = on.length !== 2;
    go.dataset.arg = on.join(",");
    host.querySelectorAll(".magnet").forEach((m) => {
      const s = on.includes(Number(m.dataset.i));
      m.setAttribute("aria-pressed", String(s));
      m.classList.toggle("stuck", s);
      (s ? door : tray).append(m);
    });
  });
}
