// Feelings face-off: two semi-finals and a final (3 taps). The last tap is [data-on=ans] "winner,finalist" (1x and 0.4x). Lazy; buttons stay if it fails.
import { html, raw } from "../../dom.js";
import { qPic } from "../../pics.js";
import { PLAY } from "../../../data/strings-play.js";

export function mount(host, q) {
  const F = PLAY.faceoff, won = [];
  const card = (i, arg) => raw(html`<button class="btn art" ${raw(arg ? `data-on="ans" data-arg="${arg}"` : `data-pick="${i}"`)}><span class="artpic">${raw(qPic(q.answers[i].e))}</span><small>${q.answers[i].t}</small></button>`);
  const round = (a, b, title, fin) => {
    host.innerHTML = html`<div class="faceoff" data-testid="faceoff"><p class="sub" aria-live="polite">${title}</p><div class="arts n2">${card(a, fin && `${a},${b}`)}${card(b, fin && `${b},${a}`)}</div></div>`;
    host.querySelectorAll("[data-pick]").forEach((el) => el.addEventListener("click", () => {
      won.push(Number(el.dataset.pick));
      won.length < 2 ? round(2, 3, F.round) : round(won[0], won[1], F.final, true);
    }));
  };
  round(0, 1, F.round);
}
