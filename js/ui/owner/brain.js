// Noga's brain: rating stats, inbox of her free-text extras, search + filter, tap-to-rate, notes, custom foods.
import { FOODS } from "../../data/foods.js";
import { STR } from "../../data/strings.js";
import { TAGS, TAG_GROUPS, KINDS } from "../../data/tags.js";
import { RATING_EMOJI } from "../../data/constants.js";
import { buildFoods } from "../../engine/foods.js";
import { newId } from "../../share/codec.js";
import { render, html, raw, toast, saveFailed } from "../dom.js";
import { pic, catLabel, foodLabel } from "../pics.js";

const B = STR.brain;
const F = STR.foodForm;
const RATES = [4, 3, 2, 1];
const norm = (s) => String(s ?? "").replace(/[\s״׳"'\-]/g, "").toLowerCase();

/** Counts by rating (4,3,2,1 and 0 = unknown). */
export function ratingStats(foods, ratings) {
  const out = { 4: 0, 3: 0, 2: 0, 1: 0, 0: 0 };
  for (const f of foods) out[ratings[f.id]?.r ?? 0]++;
  return out;
}

/** Filter by search text and rating ('all' | 0..4). */
export function filterFoods(foods, ratings, { q = "", r = "all" } = {}) {
  const t = norm(q);
  return foods.filter(
    (f) => (r === "all" || (ratings[f.id]?.r ?? 0) === Number(r)) && (!t || norm(f.name).includes(t) || f.tags.some((x) => norm(TAGS[x]).includes(t))),
  );
}

export function makeCustomFood({ name, emoji, kind, tags }) {
  const n = String(name ?? "").trim().slice(0, 40);
  if (!n) return null;
  const k = KINDS.includes(kind) ? kind : "meal";
  const rest = [...new Set(tags ?? [])].filter((t) => TAGS[t] && !KINDS.includes(t));
  return { id: `c_${newId(8)}`, name: n, emoji: String(emoji || "🍽️").slice(0, 8), tags: [k, ...rest] };
}

export function brainViews({ root, store, stack, views, back, common }) {
  const state = { q: "", r: "all" };
  const foods = () => buildFoods(FOODS, store.get().custom);
  const rate = (id, r) =>
    store
      .update((db) => {
        const cur = db.ratings[id] ?? {};
        db.ratings[id] = { ...cur, r: cur.r === r ? 0 : r };
      })
      .catch(saveFailed);

  const row = (f, ratings) => html`<li class="food-row">
      <button class="linkish" data-on="open" data-arg="${f.id}">${raw(foodLabel(f))}${f.custom ? raw(html` <small class="sub">${B.custom}</small>`) : ""}${ratings[f.id]?.n ? " 📝" : ""}</button>
      <span class="rates">${RATES.map((r) => raw(html`<button class="chip" data-on="rate" data-arg="${f.id}:${r}" aria-pressed="${ratings[f.id]?.r === r}" aria-label="${RATING_EMOJI[r]} ${f.name}">${RATING_EMOJI[r]}</button>`))}</span>
    </li>`;
  const list = () => {
    const ratings = store.get().ratings;
    const items = filterFoods(foods(), ratings, state);
    return items.length ? items.map((f) => row(f, ratings)).join("") : html`<li class="sub">${B.empty}</li>`;
  };
  const refreshList = () => {
    const ul = root.querySelector(".foods");
    if (ul) ul.innerHTML = list();
  };

  views.brain = () => {
    const db = store.get();
    const st = ratingStats(foods(), db.ratings);
    render(root, html`${raw(back)}
      <h2 class="q">${B.title(db.settings.her)}</h2>
      <div class="stats">${[4, 3, 2, 1, 0].map((r) => raw(html`<button class="chip" data-on="filter" data-arg="${r}" aria-pressed="${state.r === String(r)}">${RATING_EMOJI[r]} ${st[r]}</button>`))}
        <button class="chip" data-on="filter" data-arg="all" aria-pressed="${state.r === "all"}">${B.all}</button></div>
      ${db.inbox.length ? raw(html`<section class="card inbox"><div class="sub">${B.inbox}</div>
        ${db.inbox.map((t, i) => raw(html`<div class="row"><b>${t}</b><button class="chip" data-on="addInbox" data-arg="${i}">${B.addTags}</button><button class="chip" data-on="dropInbox" data-arg="${i}" aria-label="${B.dismissLabel(t)}">${B.dismiss}</button></div>`))}</section>`) : ""}
      <input type="search" placeholder="${B.search}" value="${state.q}" data-input="search" aria-label="${B.search}">
      <button class="btn" data-on="newFood">${B.add}</button>
      <ul class="foods">${raw(list())}</ul>`, {
      ...common,
      search: (v) => ((state.q = v), refreshList()),
      filter: (r) => ((state.r = state.r === r ? "all" : r), views.brain()),
      rate: (arg) => {
        const [id, r] = arg.split(":");
        rate(id, Number(r));
        refreshList();
      },
      open: (id) => ((state.open = id), stack.push("food")),
      newFood: () => ((state.form = { name: "", emoji: "", kind: "meal", tags: [] }), stack.push("foodForm")),
      addInbox: (i) => ((state.form = { name: db.inbox[i], emoji: "", kind: "meal", tags: [], inbox: db.inbox[i] }), stack.push("foodForm")),
      dropInbox: (i) => (store.update((d) => d.inbox.splice(Number(i), 1)).catch(saveFailed), views.brain()),
    });
  };

  // One food: rate + note; custom foods can be edited or deleted.
  views.food = () => {
    const f = foods().find((x) => x.id === state.open);
    if (!f) return stack.back();
    const cur = store.get().ratings[f.id] ?? {};
    render(root, html`${raw(back)}
      <div class="big">${raw(pic(f))}</div><h2 class="title">${f.name}</h2><p class="cat">${catLabel(f)}</p>
      <p class="sub">${f.tags.map((t) => TAGS[t]).join(" · ")}</p>
      <div class="rates big-rates">${RATES.map((r) => raw(html`<button class="chip" data-on="rate" data-arg="${r}" aria-pressed="${cur.r === r}">${RATING_EMOJI[r]}</button>`))}</div>
      <form data-submit="note" class="stack">
        <textarea name="n" rows="2" maxlength="200" placeholder="${B.note}">${cur.n ?? ""}</textarea>
        <button class="btn btn-primary" type="submit">${B.save}</button>
      </form>
      ${f.custom ? raw(html`<button class="btn" data-on="edit">${F.edit}</button><button class="btn btn-ghost" data-on="del">${B.del}</button>`) : ""}`, {
      ...common,
      rate: (r) => (rate(f.id, Number(r)), views.food()),
      note: (fd) => {
        const n = String(fd.get("n") ?? "").trim().slice(0, 200);
        store
          .update((db) => {
            db.ratings[f.id] = { ...(db.ratings[f.id] ?? { r: 0 }) };
            if (n) db.ratings[f.id].n = n;
            else delete db.ratings[f.id].n;
          })
          .catch(saveFailed);
        toast(STR.owner.saved);
        stack.back();
      },
      edit: () => ((state.form = { id: f.id, name: f.name, emoji: f.emoji, kind: f.tags[0], tags: f.tags.slice(1) }), stack.push("foodForm")),
      del: () => {
        store.update((db) => ((db.custom = db.custom.filter((c) => c.id !== f.id)), delete db.ratings[f.id])).catch(saveFailed);
        stack.back();
      },
    });
  };

  views.foodForm = () => {
    const form = state.form ?? { name: "", emoji: "", kind: "meal", tags: [] };
    const groups = Object.entries(TAG_GROUPS).filter(([g]) => g !== "kind");
    const draw = () =>
      render(root, html`${raw(back)}
        <h2 class="q">${form.id ? F.edit : F.title}</h2>
        <label class="field">${F.name}<input data-input="name" value="${form.name}" maxlength="40" autofocus></label>
        <label class="field">${F.emoji}<input data-input="emoji" value="${form.emoji}" maxlength="8" placeholder="🍽️"></label>
        <div class="field">${F.kind}<div class="chips">${KINDS.map((k) => raw(html`<button class="chip" data-on="kind" data-arg="${k}" aria-pressed="${form.kind === k}">${TAGS[k]}</button>`))}</div></div>
        <div class="field">${F.tags}${groups.map(([, tags]) => raw(html`<div class="chips">${tags.map((t) => raw(html`<button class="chip" data-on="tag" data-arg="${t}" aria-pressed="${form.tags.includes(t)}">${TAGS[t]}</button>`))}</div>`))}</div>
        <button class="btn btn-primary" data-on="save">${F.save}</button>`, {
        ...common,
        name: (v) => (form.name = v),
        emoji: (v) => (form.emoji = v),
        kind: (k) => ((form.kind = k), draw()),
        tag: (t, _e, el) => {
          form.tags = form.tags.includes(t) ? form.tags.filter((x) => x !== t) : [...form.tags, t];
          el.setAttribute("aria-pressed", String(form.tags.includes(t)));
        },
        save: () => {
          const made = makeCustomFood(form);
          if (!made) return toast(F.needName);
          if (form.id) made.id = form.id;
          store
            .update((db) => {
              db.custom = [...db.custom.filter((c) => c.id !== made.id), made];
              if (form.inbox) db.inbox = db.inbox.filter((x) => x !== form.inbox);
            })
            .catch(saveFailed);
          state.form = null;
          toast(STR.owner.saved);
          stack.back();
        },
      });
    draw();
  };
}
