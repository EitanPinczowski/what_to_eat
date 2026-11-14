// Owner: places list + form, and the place picker (PLAN.md §7.4, spec §2.7).
import { FOODS } from "../../data/foods.js";
import { STR } from "../../data/strings.js";
import { TAGS } from "../../data/tags.js";
import { buildFoods } from "../../engine/foods.js";
import { newId } from "../../share/codec.js";
import { scorePlaces, weightedPick, mapsUrl, kioskUrl, recipeUrl } from "../../places/picker.js";
import { render, html, raw, toast } from "../dom.js";

const L = STR.places;
const K = STR.picker;
const PLACE_MODES = ["sit", "take", "delivery"];
const norm = (s) => String(s ?? "").replace(/[\s״׳"'\-]/g, "").toLowerCase();

export function reasonText(r, food) {
  if (r.reason === "serves") return K.serves(food?.name ?? "");
  if (r.reason.startsWith("style:")) return K.style(r.reason.slice(6).split(",").map((t) => TAGS[t]).join(", "));
  return "";
}

export function placesViews({ root, store, stack, views, back, common, ctx }) {
  const foods = () => buildFoods(FOODS, store.get().custom);
  const cities = () => [...new Set([store.get().settings.city, ...store.list("places").map((p) => p.city)].filter(Boolean))];

  // ---------- places ----------
  views.places = () => {
    const list = store.list("places");
    const byCity = {};
    for (const p of list) (byCity[p.city || "—"] ??= []).push(p);
    render(root, html`${raw(back)}
      <h2 class="q">${L.title}</h2>
      <button class="btn" data-on="add">${L.add}</button>
      ${list.length ? "" : raw(html`<p class="sub">${L.empty}</p>`)}
      ${Object.entries(byCity).map(([city, ps]) => raw(html`<section><h3 class="sub">${city}</h3>
        ${ps.map((p) => raw(html`<button class="btn place-row" data-on="edit" data-arg="${p.id}"><b>${p.name}</b><span class="sub">${"₪".repeat(p.price || 0)} ${"❤️".repeat(Math.round(p.rating || 0))}</span></button>`))}</section>`))}`, {
      ...common,
      add: () => ((ctx.place = { name: "", city: store.get().settings.city, modes: [], foods: [], price: 2, rating: 3, link: "", note: "", shabbat: false, visits: [] }), stack.push("placeForm")),
      edit: (id) => ((ctx.place = store.doc("places", id)), stack.push("placeForm")),
    });
  };

  views.placeForm = () => {
    const p = ctx.place;
    let q = "";
    const all = foods();
    const matches = () => (q ? all.filter((f) => norm(f.name).includes(norm(q)) && !p.foods.includes(f.id)).slice(0, 8) : []);
    const chip = (on, arg, label, pressed) => raw(html`<button class="chip" data-on="${on}" data-arg="${arg}" aria-pressed="${pressed}">${label}</button>`);
    const servedHtml = () => p.foods.map((id) => all.find((f) => f.id === id)).filter(Boolean).map((f) => chip("unserve", f.id, `${f.emoji} ${f.name} ✕`, true));
    const refresh = () => {
      root.querySelector(".served").innerHTML = servedHtml().map((x) => x.s).join("");
      root.querySelector(".matches").innerHTML = matches().map((f) => chip("serve", f.id, `${f.emoji} ${f.name}`, false).s).join("");
    };
    const draw = () =>
      render(root, html`${raw(back)}
        <h2 class="q">${p.id ? L.edit : L.add}</h2>
        <label class="field">${L.name}<input data-input="name" value="${p.name}" maxlength="60" autofocus></label>
        <label class="field">${L.city}<input data-input="city" value="${p.city}" maxlength="40" list="cities"><datalist id="cities">${cities().map((c) => raw(html`<option value="${c}">`))}</datalist></label>
        <div class="field">${L.modes}<div class="chips">${PLACE_MODES.map((m) => chip("mode", m, STR.modeLabel[m], p.modes.includes(m)))}</div></div>
        <div class="field">${L.foods}<div class="chips served">${servedHtml()}</div>
          <input type="search" data-input="foodq" placeholder="${L.foodSearch}" aria-label="${L.foodSearch}"><div class="chips matches"></div></div>
        <div class="field">${L.price}<div class="chips">${[1, 2, 3].map((n) => chip("price", n, "₪".repeat(n), p.price === n))}</div></div>
        <div class="field">${L.rating}<div class="chips">${[1, 2, 3, 4, 5].map((n) => chip("rating", n, "❤️".repeat(n), Math.round(p.rating) === n))}</div></div>
        <label class="field">${L.link}<input data-input="link" value="${p.link}" maxlength="300" dir="ltr" inputmode="url"></label>
        <label class="field">${L.note}<input data-input="note" value="${p.note}" maxlength="200"></label>
        <label class="check"><input type="checkbox" data-input="shabbat" ${p.shabbat ? "checked" : ""}> ${L.shabbat}</label>
        <button class="btn btn-primary" data-on="save">${L.save}</button>
        ${p.id ? raw(html`<button class="btn btn-ghost" data-on="del">${L.del}</button>`) : ""}`, {
        ...common,
        name: (v) => (p.name = v),
        city: (v) => (p.city = v.trim()),
        link: (v) => (p.link = v.trim()),
        note: (v) => (p.note = v),
        foodq: (v) => ((q = v), refresh()),
        serve: (id) => (p.foods.push(id), refresh()),
        unserve: (id) => ((p.foods = p.foods.filter((x) => x !== id)), refresh()),
        mode: (m, _e, el) => ((p.modes = p.modes.includes(m) ? p.modes.filter((x) => x !== m) : [...p.modes, m]), el.setAttribute("aria-pressed", String(p.modes.includes(m)))),
        price: (n) => ((p.price = Number(n)), draw()),
        rating: (n) => ((p.rating = Number(n)), draw()),
        shabbat: (_v, _e, el) => (p.shabbat = el.checked),
        save: () => {
          if (!p.name.trim()) return toast(L.needName);
          const { id = newId(12), ...data } = p;
          store.put("places", id, { ...data, name: data.name.trim().slice(0, 60), link: /^https?:\/\//.test(data.link) ? data.link : "" }).catch(() => {});
          toast(STR.owner.saved);
          stack.back();
        },
        del: () => (store.remove("places", p.id).catch(() => {}), stack.back()),
      });
    draw();
  };

  // ---------- picker ----------
  views.picker = () => {
    const entry = ctx.entryId ? store.doc("history", ctx.entryId) : null;
    const all = foods();
    const st = (ctx.pick ??= {
      food: entry?.f ?? null,
      free: entry && !entry.f ? entry.fn : "",
      mode: entry?.m && entry.m !== "any" ? entry.m : null,
      city: store.get().settings.city || null,
      budget: entry?.price ?? null,
      chosen: null,
    });
    const food = all.find((f) => f.id === st.food) ?? null;
    const label = food?.name ?? st.free;
    const scored = scorePlaces(store.list("places"), all, { food, mode: st.mode, city: st.city, budget: st.budget });
    const chip = (on, arg, text, pressed) => raw(html`<button class="chip" data-on="${on}" data-arg="${arg}" aria-pressed="${pressed}">${text}</button>`);
    const q = [label, st.city].filter(Boolean).join(" ");
    render(root, html`${raw(back)}
      <h2 class="q">${K.title}</h2>
      <label class="field">${K.food}<select data-input="food"><option value="">${K.anyFood}</option>${all.map((f) => raw(html`<option value="${f.id}" ${f.id === st.food ? "selected" : ""}>${f.emoji} ${f.name}</option>`))}</select></label>
      <div class="field">${K.mode}<div class="chips">${PLACE_MODES.map((m) => chip("mode", m, STR.modeLabel[m], st.mode === m))}${chip("mode", "home", STR.modeLabel.home, st.mode === "home")}</div></div>
      <div class="field">${K.city}<div class="chips">${chip("city", "", K.anyCity, !st.city)}${cities().map((c) => chip("city", c, c, st.city === c))}</div></div>
      ${st.chosen ? raw(html`<section class="card chosen" data-testid="chosen"><div class="big" aria-hidden="true">🎯</div><h3 class="title">${st.chosen}</h3>
          <button class="btn btn-primary" data-on="go" data-arg="${st.chosen}">${K.go}</button></section>`) : ""}
      ${scored.length && st.mode !== "home" ? raw(html`<button class="btn btn-primary" data-on="roll">${K.roll}</button>
        <ul class="foods">${scored.map((r) => raw(html`<li class="food-row"><button class="linkish" data-on="choose" data-arg="${r.place.id}"><b>${r.place.name}</b> <span class="sub">${reasonText(r, food)}</span></button><span class="sub">${r.score}</span></li>`))}</ul>`) : raw(html`<p class="sub">${st.mode === "home" ? "" : K.none}</p>`)}
      <div class="stack fallbacks">
        ${st.mode === "home" ? raw(html`<a class="btn" href="${recipeUrl(label || "")}" target="_blank" rel="noopener" data-on="fallback">${K.recipe}</a>`) : raw(html`<a class="btn" href="${mapsUrl(q || "אוכל")}" target="_blank" rel="noopener" data-on="fallback">${K.maps(q)}</a>`)}
        ${food?.tags[0] === "snack" ? raw(html`<a class="btn" href="${kioskUrl()}" target="_blank" rel="noopener" data-on="fallback">${K.kiosk}</a>`) : ""}
      </div>
      ${ctx.quickAdd ? raw(html`<form class="card stack" data-submit="quick" data-testid="quick-add"><b>${K.whereWent}</b>
          <input name="name" maxlength="60" placeholder="${K.whereWentPh}" autofocus>
          <button class="btn btn-primary" type="submit">${K.quickSave}</button>
          <button class="btn btn-ghost" type="button" data-on="noQuick">${K.skip}</button></form>`) : ""}`, {
      ...common,
      food: (v) => ((st.food = v || null), (st.free = ""), (st.chosen = null), views.picker()),
      mode: (m) => ((st.mode = st.mode === m ? null : m), (st.chosen = null), views.picker()),
      city: (c) => ((st.city = c || null), (st.chosen = null), views.picker()),
      choose: (id) => ((st.chosen = store.doc("places", id)?.name ?? null), (st.chosenId = id), views.picker()),
      roll: () => roll(scored, st),
      go: () => goTo(st.chosenId, st),
      // Opening a fallback link counts as "we're going"; then ask where, to save the place in two taps.
      fallback: (_a, e, el) => {
        window.open(el.href, "_blank", "noopener");
        markGoing(null);
        ctx.quickAdd = true;
        views.picker();
      },
      quick: (fd) => {
        const name = String(fd.get("name") ?? "").trim().slice(0, 60);
        if (!name) return;
        const id = newId(12);
        const mode = st.mode && st.mode !== "home" ? [st.mode] : [];
        store.put("places", id, { name, city: st.city ?? "", modes: mode, foods: st.food ? [st.food] : [], price: st.budget ?? 2, rating: 3, link: "", note: "", shabbat: false, visits: [new Date().toISOString()] }).catch(() => {});
        markGoing(id);
        ctx.quickAdd = false;
        toast(K.logged);
        done();
      },
      noQuick: () => ((ctx.quickAdd = false), done()),
    });
  };

  function roll(scored, st) {
    const names = scored.map((r) => r.place.name);
    const final = weightedPick(scored);
    let i = 0;
    const box = document.createElement("div");
    box.className = "card chosen slot";
    box.setAttribute("aria-hidden", "true");
    root.querySelector(".q").after(box);
    const reduce = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const tick = () => {
      box.textContent = names[i++ % names.length];
      if (!reduce && i < 14) setTimeout(tick, 40 + i * 12);
      else ((st.chosen = final.place.name), (st.chosenId = final.place.id), views.picker());
    };
    tick();
  }

  function markGoing(placeId) {
    const now = new Date().toISOString();
    if (ctx.entryId) {
      const h = store.doc("history", ctx.entryId);
      if (h) store.put("history", ctx.entryId, { ...h, goAt: now, ...(placeId ? { place: placeId } : {}) }).catch(() => {});
    }
  }

  function goTo(placeId, st) {
    const p = placeId && store.doc("places", placeId);
    if (p) store.put("places", placeId, { ...p, visits: [...(p.visits ?? []), new Date().toISOString()].slice(-30) }).catch(() => {});
    markGoing(placeId);
    toast(K.logged);
    done();
  }

  function done() {
    ctx.pick = null;
    ctx.entryId = null;
    stack.reset("home");
  }
}
