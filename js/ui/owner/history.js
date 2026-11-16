// Owner: history list with the hit-rate stats card (loaded on first use).
import { STR } from "../../data/strings.js";
import { statsFrom } from "../../engine/learn.js";
import { QUESTIONS } from "../../data/questions.js";
import { render, html, raw } from "../dom.js";

const T = STR.owner;
const fmtDate = (iso) => {
  try {
    return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "numeric", weekday: "short" });
  } catch {
    return "";
  }
};

export function historyViews({ root, store, views, back, common }) {
  const statsCard = (list) => {
    const st = statsFrom(list);
    if (!st) return "";
    const q = QUESTIONS.find((x) => x.id === st.confusing);
    return html`<section class="card stats-card" data-testid="stats">
      <div>${T.stats.hit(Math.round(st.hitRate * 100))} · ${T.stats.steps(st.avgSteps.toFixed(1))} · ${T.stats.n(st.n)}</div>
      ${q ? raw(html`<div class="sub">${T.stats.confusing(q.text)}</div>`) : ""}</section>`;
  };

  views.history = () => {
    const list = store.list("history");
    render(root, html`${raw(back)}
      <h2 class="q">${T.historyTitle}</h2>
      ${raw(statsCard(list))}
      ${list.length ? "" : raw(html`<p class="sub">${T.noHistory}</p>`)}
      ${list.map((h) => raw(html`<article class="card hist">
        <div class="line"><span class="em">${h.fe}</span><b>${h.fn}</b><span class="sub">${fmtDate(h.at)}</span></div>
        <div class="sub">${STR.modeLabel[h.m] ?? ""}${h.price ? ` · ${"₪".repeat(h.price)}` : ""}</div>
        ${h.note ? raw(html`<p class="note">“${h.note}”</p>`) : ""}
        ${h.trail?.length ? raw(html`<details><summary>${T.trail}</summary><ol>${h.trail.map((t) => raw(html`<li>${t}</li>`))}</ol></details>`) : ""}
        <button class="btn btn-ghost" data-on="pickFor" data-arg="${h.id}">${T.pickPlace}</button>
      </article>`))}`, common);
  };
}
