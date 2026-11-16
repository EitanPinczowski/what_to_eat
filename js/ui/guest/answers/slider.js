// Slider answer: a real <input type=range> with snapping emoji stops (keyboard works). Lazy module; the buttons stay if it fails to load.
import { html, raw } from "../../dom.js";
import { qPic } from "../../pics.js";
import { STR } from "../../../data/strings.js";

const A = STR.answers;

/** mount(host, q): host's buttons become the slider; the confirm button is [data-on=ans] so the quiz handles it like any answer. */
export function mount(host, q, { thermo = false } = {}) {
  const n = q.answers.length, mid = Math.floor(n / 2);
  host.innerHTML = html`<div class="slider ${thermo ? "thermo" : ""}" data-testid="${thermo ? "thermo" : "slider"}">
    <div class="stops" aria-hidden="true">${q.answers.map((a, i) => raw(html`<span class="stop${i === mid ? " on" : ""}" data-i="${i}">${raw(qPic(a.e))}</span>`))}</div>
    <div class="rail"><div class="mercury" style="--p:${(mid / (n - 1)) * 100}%"></div>
      <input type="range" min="0" max="${n - 1}" step="1" value="${mid}" aria-label="${q.text}" aria-valuetext="${q.answers[mid].t}"></div>
    <p class="sub now" aria-live="polite">${q.answers[mid].t}</p>
    <button class="btn btn-primary" data-on="ans" data-arg="${mid}">${thermo ? A.thermoDone : A.sliderDone}</button></div>`;
  const input = host.querySelector("input"), btn = host.querySelector("button"), now = host.querySelector(".now"), merc = host.querySelector(".mercury");
  const set = () => {
    const v = Number(input.value);
    btn.dataset.arg = String(v);
    now.textContent = q.answers[v].t;
    input.setAttribute("aria-valuetext", q.answers[v].t);
    merc.style.setProperty("--p", `${(v / (n - 1)) * 100}%`);
    host.querySelectorAll(".stop").forEach((s) => s.classList.toggle("on", Number(s.dataset.i) === v));
  };
  let last = mid;
  input.addEventListener("input", () => {
    set();
    if (Number(input.value) !== last) ((last = Number(input.value)), globalThis.navigator?.vibrate?.(6)); // a tick at each stop
  });
}
