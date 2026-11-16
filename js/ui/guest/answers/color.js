// Mood color answer: round swatches, tap one.
import { html, raw } from "../../dom.js";

export function mount(host, q, order) {
  host.innerHTML = html`<div class="swatches">${order.map((i) => raw(html`<button class="btn swatch" data-on="ans" data-arg="${i}" style="--c:${q.answers[i].c ?? "#999"}"><span class="dot" aria-hidden="true"></span><small>${q.answers[i].t}</small></button>`))}</div>`;
}
