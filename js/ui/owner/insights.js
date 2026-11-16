// Owner: "what did we learn" screen (item 31), loaded on first use. All numbers come from js/engine/insights.js.
import { INS } from "../../data/strings-insights.js";
import { FOODS } from "../../data/foods.js";
import { QUESTIONS } from "../../data/questions.js";
import { buildFoods } from "../../engine/foods.js";
import { insightsFor } from "../../engine/insights.js";
import { loadEvents } from "../../store/events.js";
import { render, html, raw, topbar } from "../dom.js";

const section = (title, body) => html`<section class="card stack"><h3>${title}</h3>${raw(body)}</section>`;
const list = (rows) => (rows.length ? rows.map((r) => html`<div>${raw(r)}</div>`).join("") : html`<p class="sub">${INS.noneYet}</p>`);

/** The screen body for computed insights `x` (pure markup, no store). */
export function insightsHtml(x) {
  if (!x.enough) return html`<p class="sub" data-testid="ins-empty">${INS.empty}</p>`;
  const acc = (label, a) => (a ? html`<b>${label}</b> · ${INS.accLine(a)}` : html`<b>${label}</b> · ${INS.accNone}`);
  const f = x.funnel;
  return [
    section(INS.accTitle, list([acc(INS.accCur, x.month.cur), acc(INS.accPrev, x.month.prev)])),
    section(INS.funnelTitle, f.some((s) => s.n) ? list(f.map((s) => html`${INS.funnel[s.k]}: <b>${s.n}</b>`)) : html`<p class="sub">${INS.funnelNone}</p>`),
    section(INS.decTitle, x.decision ? html`<p>${INS.decLine(x.decision.median, x.decision.n)}</p>` : html`<p class="sub">${INS.noneYet}</p>`),
    section(INS.placesTitle, list(x.places.map((p) => html`${p.name} <small>${INS.count(p.n)}</small>`))),
    section(INS.rejTitle, list(x.rejected.map((r) => html`${r.emoji} ${r.name} <small>${INS.count(r.n)}</small>`))),
    section(INS.weatherTitle, list(x.weather.map((v) => html`<b>${INS.weather[v.key] ?? v.key}</b> · ${INS.viewLine(v)}`))),
    section(INS.weekdayTitle, list(x.weekday.map((v) => html`<b>${INS.days[v.key] ?? v.key}</b> · ${INS.viewLine(v)}`))),
    section(INS.uselessTitle, html`<p class="sub">${INS.uselessSub}</p>` + (x.useless.length ? list(x.useless.map((u) => html`${INS.uselessLine(u)}`)) : html`<p class="sub">${INS.uselessNone}</p>`)),
  ].join("");
}

export function insightsViews({ root, store, views, common }) {
  views.insights = async () => {
    render(root, html`${raw(topbar(INS.title))}<p class="sub" role="status">${INS.loading}</p>`, common);
    const events = await loadEvents(store);
    const places = Object.fromEntries(store.list("places").map((p) => [p.id, { name: p.name }]));
    const foods = buildFoods(FOODS, store.get().custom);
    const x = insightsFor({ history: store.list("history"), events, places, foods, questions: QUESTIONS });
    if (!root.querySelector?.("[role=status]")) return; // she left the screen meanwhile
    render(root, html`${raw(topbar(INS.title))}<div class="stack" data-testid="insights">${raw(insightsHtml(x))}</div>`, common);
  };
}
