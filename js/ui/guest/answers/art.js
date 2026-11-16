// Art answer: 2-4 big Fluent pictures, tap one (a short caption keeps it readable for a screen reader).
import { html, raw } from "../../dom.js";
import { qPic } from "../../pics.js";

export function mount(host, q, order) {
  host.innerHTML = html`<div class="arts n${q.answers.length}">${order.map((i) => raw(html`<button class="btn art" data-on="ans" data-arg="${i}"><span class="artpic">${raw(qPic(q.answers[i].e))}</span><small>${q.answers[i].t}</small></button>`))}</div>`;
}
