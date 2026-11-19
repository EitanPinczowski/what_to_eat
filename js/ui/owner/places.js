// Owner: places list + form, and the place picker (PLAN.md §7.4, spec §2.7).
import { FOODS } from "../../data/foods.js";
import { STR } from "../../data/strings.js";
import { TAGS } from "../../data/tags.js";
import { buildFoods } from "../../engine/foods.js";
import { CUISINES, expandCuisines } from "../../data/cuisines.js";
import { cuisinesOfFoods } from "../../places/cuisine.js";
import { newId } from "../../share/codec.js";
import { pickPlaces, weightedPick, navLinks, mapsUrl, kioskUrl, woltUrl, tenbisUrl, cuisineSearch } from "../../places/picker.js";
import { parsePlaceLink, bookingOf, ontopoUrl, TABIT_SEARCH } from "../../places/links.js";
import { recipesFor } from "../../data/recipes.js";
import { recipeBlock } from "./shopping.js";
import { VOTE_MAX, VOTE_MIN, VOTE_NONE } from "../../store/store.js";
import { render, html, raw, toast, saveFailed, topbar, keepOpen } from "../dom.js";

const L = STR.places;
const K = STR.picker;
const PLACE_MODES = ["sit", "take", "delivery"];
const cuisineLabel = (c) => STR.cuisine.options[c].join(" ");
const chip = (on, arg, label, pressed) => raw(html`<button class="chip" data-on="${on}" data-arg="${arg}" aria-pressed="${pressed}">${label}</button>`);
const norm = (s) => String(s ?? "").replace(/[\s״׳"'\-]/g, "").toLowerCase();

export function reasonText(r, food) {
  if (r.reason === "new") return K.isNew;
  if (r.reason === "serves") return K.serves(food?.name ?? "");
  if (r.reason.startsWith("cuisine:")) return K.cuisine(r.reason.slice(8).split(",").map((c) => STR.cuisine.options[c][1]).join(", "));
  if (r.reason.startsWith("style:")) return K.style(r.reason.slice(6).split(",").map((t) => TAGS[t]).join(", "));
  return "";
}

export const closesText = (r) => (r.closesIn ? K.closesSoon(r.closesIn) : "");

export function placesViews({ root, store, stack, views, common, ctx }) {
  keepOpen(root, ctx);
  const foods = () => buildFoods(FOODS, store.get().custom);
  const cities = () => [...new Set([store.get().settings.city, ...store.list("places").map((p) => p.city)].filter(Boolean))];

  views.places = () => {
    const fc = (ctx.placeCuisine ??= null);
    const list = store.list("places").filter((p) => !fc || expandCuisines(p.cuisines).includes(fc));
    const byCity = {};
    for (const p of list) (byCity[p.city || "—"] ??= []).push(p);
    render(root, html`${raw(topbar(L.title))}
      <button class="btn" data-on="add">${L.add}</button>
      <button class="btn" data-on="tryAdd" data-testid="try-add">${L.tryAdd}</button>
      <div class="chips" data-testid="cuisine-filter">${raw(html`<button class="chip" data-on="cfilter" data-arg="" aria-pressed="${!fc}">${L.filterAll}</button>`)}${CUISINES.map((c) => raw(html`<button class="chip" data-on="cfilter" data-arg="${c}" aria-pressed="${fc === c}">${cuisineLabel(c)}</button>`))}</div>
      ${list.length ? "" : raw(html`<p class="sub">${L.empty}</p>`)}
      ${Object.entries(byCity).map(([city, ps]) => raw(html`<section><h3 class="sub">${city}</h3>
        ${ps.map((p) => raw(html`<button class="btn place-row" data-on="edit" data-arg="${p.id}"><b>${p.name}</b>${p.wantTry && !(p.visits ?? []).length ? raw(html`<span class="sub">${L.tryBadge}</span>`) : ""}<span class="sub">${"₪".repeat(p.price || 0)} ${"❤️".repeat(Math.round(p.rating || 0))}</span></button>`))}</section>`))}`, {
      ...common,
      add: () => ((ctx.place = { name: "", city: store.get().settings.city, modes: [], foods: [], cuisines: [], price: 2, rating: 3, link: "", note: "", shabbat: false, hours: [], visits: [] }), stack.push("placeForm")),
      cfilter: (c) => ((ctx.placeCuisine = c || null), views.places()),
      edit: (id) => ((ctx.place = store.doc("places", id)), stack.push("placeForm")),
      tryAdd: () => ((ctx.tryDraft = { link: "", name: "" }), stack.push("tryForm")),
    });
  };

  views.tryForm = () => {
    const d = ctx.tryDraft;
    let ask = false;
    const draw = () =>
      render(root, html`${raw(topbar(L.tryTitle))}
        <label class="field">${L.tryLink}<input data-input="link" value="${d.link}" maxlength="300" dir="ltr" inputmode="url" data-testid="try-link"></label>
        <label class="field">${ask ? L.tryAsk : L.tryName}<input data-input="name" value="${d.name}" maxlength="60" data-testid="try-name"></label>
        <button class="btn btn-primary act" data-on="save" data-testid="try-save">${L.save}</button>`, {
        ...common,
        link: (v, _e, el) => {
          d.link = v.trim();
          const r = parsePlaceLink(d.link);
          if (r?.name && !d.nameTouched) {
            d.name = r.name;
            const n = root.querySelector('[data-input="name"]');
            if (n) n.value = r.name;
          }
        },
        name: (v) => ((d.name = v), (d.nameTouched = true)),
        save: () => {
          const r = parsePlaceLink(d.link);
          if (!r) return toast(L.tryBad);
          const name = d.name.trim().slice(0, 60);
          if (!name) return ((ask = true), draw(), toast(L.tryAsk));
          store.put("places", newId(12), { name, city: store.get().settings.city ?? "", modes: ["sit", "take"], foods: [], cuisines: [], price: 2, rating: 3, link: r.url, note: "", shabbat: false, hours: [], visits: [], wantTry: true }).catch(saveFailed);
          toast(STR.owner.saved);
          stack.back();
        },
      });
    draw();
  };

  views.placeForm = () => {
    const p = ctx.place;
    p.cuisines = expandCuisines(p.cuisines); // an old "asian" opens as its four countries
    let q = "";
    const all = foods();
    const matches = () => (q ? all.filter((f) => norm(f.name).includes(norm(q)) && !p.foods.includes(f.id)).slice(0, 8) : []);
    const servedHtml = () => p.foods.map((id) => all.find((f) => f.id === id)).filter(Boolean).map((f) => chip("unserve", f.id, `${f.emoji} ${f.name} ✕`, true));
    const refresh = () => {
      root.querySelector(".served").innerHTML = servedHtml().map((x) => x.s).join("");
      root.querySelector(".matches").innerHTML = matches().map((f) => chip("serve", f.id, `${f.emoji} ${f.name}`, false).s).join("");
    };
    const draw = () =>
      render(root, html`${raw(topbar(p.id ? L.edit : L.add))}
        <label class="field">${L.name}<input data-input="name" value="${p.name}" maxlength="60" autofocus></label>
        <label class="field">${L.city}<input data-input="city" value="${p.city}" maxlength="40" list="cities"><datalist id="cities">${cities().map((c) => raw(html`<option value="${c}">`))}</datalist></label>
        <div class="field">${L.modes}<div class="chips">${PLACE_MODES.map((m) => chip("mode", m, STR.modeLabel[m], p.modes.includes(m)))}</div></div>
        <div class="field">${L.cuisines}<div class="chips" data-testid="cuisine-chips">${CUISINES.map((c) => chip("cuisine", c, cuisineLabel(c), p.cuisines.includes(c)))}</div></div>
        <div class="field">${L.foods}<div class="chips served">${servedHtml()}</div>
          <input type="search" data-input="foodq" placeholder="${L.foodSearch}" aria-label="${L.foodSearch}"><div class="chips matches"></div></div>
        <div class="field">${L.price}<div class="chips">${[1, 2, 3].map((n) => chip("price", n, "₪".repeat(n), p.price === n))}</div></div>
        <div class="field">${L.rating}<div class="chips">${[1, 2, 3, 4, 5].map((n) => chip("rating", n, "❤️".repeat(n), Math.round(p.rating) === n))}</div></div>
        <details data-k="more" class="stack" ${ctx.more ? "open" : ""}><summary>${L.more}</summary>
        <label class="field">${L.link}<input data-input="link" value="${p.link}" maxlength="300" dir="ltr" inputmode="url"></label>
        <label class="field">${L.note}<input data-input="note" value="${p.note}" maxlength="200"></label>
        <label class="check"><input type="checkbox" data-input="shabbat" ${p.shabbat ? "checked" : ""}> ${L.shabbat}</label>
        <div class="field">${L.hours}${L.days.map((dn, d) => {
          const r = (p.hours ?? []).find((h) => h.d === d);
          return raw(html`<div class="hours-row"><b>${dn}</b>
            <input type="time" data-input="hour" data-day="${d}" data-k="o" value="${r?.o ?? ""}" aria-label="${L.opensAt} ${dn}">
            <input type="time" data-input="hour" data-day="${d}" data-k="c" value="${r?.c ?? ""}" aria-label="${L.closesAt} ${dn}"></div>`);
        })}</div></details>
        ${p.id ? raw(html`<button class="btn btn-ghost" data-on="del">${L.del}</button>`) : ""}
        <button class="btn btn-primary act" data-on="save">${L.save}</button>`, {
        ...common,
        name: (v) => (p.name = v),
        city: (v) => (p.city = v.trim()),
        link: (v) => (p.link = v.trim()),
        note: (v) => (p.note = v),
        foodq: (v) => ((q = v), refresh()),
        serve: (id) => {
          p.foods.push(id);
          for (const c of cuisinesOfFoods([id], all)) if (!p.cuisines.includes(c)) p.cuisines.push(c);
          p.cuisines = CUISINES.filter((c) => p.cuisines.includes(c));
          root.querySelectorAll('[data-on="cuisine"]').forEach((b) => b.setAttribute("aria-pressed", String(p.cuisines.includes(b.dataset.arg))));
          refresh();
        },
        cuisine: (c, _e, el) => ((p.cuisines = p.cuisines.includes(c) ? p.cuisines.filter((x) => x !== c) : CUISINES.filter((x) => x === c || p.cuisines.includes(x))), el.setAttribute("aria-pressed", String(p.cuisines.includes(c)))),
        unserve: (id) => ((p.foods = p.foods.filter((x) => x !== id)), refresh()),
        mode: (m, _e, el) => ((p.modes = p.modes.includes(m) ? p.modes.filter((x) => x !== m) : [...p.modes, m]), el.setAttribute("aria-pressed", String(p.modes.includes(m)))),
        price: (n) => ((p.price = Number(n)), draw()),
        rating: (n) => ((p.rating = Number(n)), draw()),
        shabbat: (_v, _e, el) => (p.shabbat = el.checked),
        hour: (v, _e, el) => {
          const d = Number(el.dataset.day);
          const hrs = (p.hours ??= []);
          let r = hrs.find((h) => h.d === d);
          if (!r) hrs.push((r = { d, o: "", c: "" }));
          r[el.dataset.k] = v;
        },
        save: () => {
          if (!p.name.trim()) return toast(L.needName);
          const { id = newId(12), ...data } = p;
          const hours = (data.hours ?? []).filter((h) => h.o && h.c).sort((a, b) => a.d - b.d);
          store.put("places", id, { ...data, cuisines: CUISINES.filter((c) => (data.cuisines ?? []).includes(c)).slice(0, 8), hours, name: data.name.trim().slice(0, 60), link: /^https?:\/\//.test(data.link) ? data.link : "" }).catch(saveFailed);
          toast(STR.owner.saved);
          stack.back();
        },
        del: () => (store.remove("places", p.id).catch(saveFailed), stack.back()),
      });
    draw();
  };

  const her = () => store.get().settings.her;
  let seenPick = store.vote()?.pick ?? null;
  store.subscribe((what) => {
    const p = store.vote()?.pick ?? null;
    if (what !== "live" || p === seenPick) return;
    seenPick = p;
    if (p && stack.top === "picker" && !ctx.navTo) views.picker();
  });
  const voteCard = (st, prim) => {
    const v = store.vote();
    const sel = st.sel ?? [];
    const send = sel.length >= VOTE_MIN
      ? html`<button class="btn" data-on="voteSend" data-testid="vote-send">${K.voteSend(her(), sel.length)}</button>`
      : html`<p class="sub">${K.voteNeed(her())}</p>`;
    if (!v) return sel.length ? send : "";
    const idx = v.ids.indexOf(v.pick);
    const line = v.pick === VOTE_NONE ? K.voteNone(her()) : idx >= 0 ? K.votePicked(her(), v.names[idx]) : K.voteSent(her());
    return html`<section class="card chosen" data-testid="vote-status"><h3 class="title" role="status">${line}</h3>
      ${idx >= 0 && store.doc("places", v.pick) ? raw(html`<button class="btn" data-on="go" data-arg="${v.pick}" data-testid="vote-go">${K.go}</button>`) : ""}
      <button class="btn btn-ghost" data-on="voteClear">${K.voteClear}</button></section>${sel.length ? raw(send) : ""}`;
  };

  views.picker = () => {
    if (ctx.navTo) {
      const n = navLinks(ctx.navTo);
      render(root, html`<h2 class="q">${STR.picker.navTitle}</h2>
        <section class="card chosen" data-testid="nav"><div class="big" aria-hidden="true">🎯</div><h3 class="title">${ctx.navTo.name}</h3>
          <div class="stack"><a class="btn" href="${n.maps}" target="_blank" rel="noopener" data-testid="nav-maps">${STR.picker.gmaps}</a>
          <button class="btn btn-ghost" data-on="navDone">${STR.picker.navDone}</button></div></section>
        <a class="btn btn-primary act" href="${n.waze}" target="_blank" rel="noopener" data-testid="nav-waze">${STR.picker.waze}</a>`, { navDone: () => ((ctx.navTo = null), done()) });
      return;
    }
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
    if (st.cuisine === undefined) st.cuisine = food?.cuisine?.[0] ?? null;
    const label = food?.name ?? st.free;
    const term = (st.cuisine && cuisineSearch(st.cuisine)) || label;
    const { list: scored, noneOfKind } = pickPlaces(store.list("places"), all, { food, cuisine: st.cuisine, mode: st.mode, city: st.city, budget: st.budget, novel: !!st.novel, never: store.get().never });
    const q = [term, st.city].filter(Boolean).join(" ");
    const book = st.chosen && st.chosenId ? bookingOf(store.doc("places", st.chosenId)?.link) : null;
    const bookLink = book ? store.doc("places", st.chosenId).link : "";
    const searchSit = !st.mode || st.mode === "sit";
    const prim = st.chosen ? "go" : ctx.quickAdd ? "quick" : scored.length && st.mode !== "home" ? "roll" : "";
    render(root, html`${raw(topbar(K.title))}
      <div class="field">${K.food}<div class="chips" data-testid="picker-cuisine">${chip("cuisine", "", L.filterAll, !st.cuisine)}${CUISINES.map((c) => chip("cuisine", c, cuisineLabel(c), st.cuisine === c))}</div>
        ${food ? raw(html`<p class="sub" data-testid="wanted">${K.wanted(her(), `${food.emoji} ${food.name}`)}</p>`) : ""}</div>
      <div class="field">${K.mode}<div class="chips">${PLACE_MODES.map((m) => chip("mode", m, STR.modeLabel[m], st.mode === m))}${chip("mode", "home", STR.modeLabel.home, st.mode === "home")}</div></div>
      <div class="field"><div class="chips">${chip("novel", "", K.novel, !!st.novel)}</div></div>
      <div class="field">${K.city}<div class="chips">${chip("city", "", K.anyCity, !st.city)}${cities().map((c) => chip("city", c, c, st.city === c))}</div></div>
      ${raw(voteCard(st))}
      ${st.chosen ? raw(html`<section class="card chosen" data-testid="chosen"><div class="big" aria-hidden="true">🎯</div><h3 class="title">${st.chosen}</h3></section>`) : ""}
      ${scored.length && noneOfKind && st.mode !== "home" ? raw(html`<p class="sub" data-testid="none-of-kind">${K.noneOfKind((food?.cuisine ?? []).map((c) => STR.cuisine.options[c][1]).join(", "))}</p>`) : ""}
      ${scored.length && st.mode !== "home" ? raw(html`${prim === "roll" ? "" : raw(html`<button class="btn" data-on="roll">${K.roll}</button>`)}
        <ul class="foods">${scored.map((r) => raw(html`<li class="row"><button class="linkish" data-on="choose" data-arg="${r.place.id}"><b>${r.place.name}</b> <span class="sub">${reasonText(r, food)}</span> ${r.closesIn ? raw(html`<span class="sub" data-testid="closes-soon">⏰ ${closesText(r)}</span>`) : ""}</button><button class="chip" data-on="voteToggle" data-arg="${r.place.id}" aria-pressed="${(st.sel ?? []).includes(r.place.id)}">${(st.sel ?? []).includes(r.place.id) ? K.voteIn : K.voteAdd}</button><span class="sub">${r.score}</span></li>`))}</ul>`) : raw(html`<p class="sub">${st.mode === "home" ? "" : K.none}</p>${st.mode === "home" || store.list("places").length ? "" : raw(html`<button class="btn btn-primary" data-on="add" data-testid="empty-add">${K.addFirst}</button>`)}`)}
      <div class="stack fallbacks">
        ${st.mode === "home" ? raw(recipeBlock(recipesFor(food?.id, label), label || "")) : raw(html`<a class="btn" href="${mapsUrl(q || K.anyTerm)}" target="_blank" rel="noopener" data-on="fallback">${K.maps(q || K.anyTerm)}</a>`)}
        ${st.mode === "delivery" && !scored.length ? raw(html`<a class="btn" href="${woltUrl(term || "אוכל")}" target="_blank" rel="noopener" data-on="fallback">${K.wolt(term || "אוכל")}</a>
          <a class="btn" href="${tenbisUrl(term || "אוכל")}" target="_blank" rel="noopener" data-on="fallback">${K.tenbis(term || "אוכל")}</a>`) : ""}
        ${searchSit ? raw(html`<a class="btn" href="${TABIT_SEARCH}" target="_blank" rel="noopener" data-testid="tabit-search">${K.tabitSearch}</a>
          <a class="btn" href="${ontopoUrl(st.city)}" target="_blank" rel="noopener" data-testid="ontopo-search">${K.ontopoSearch}</a>`) : ""}
        ${food?.tags[0] === "snack" || st.cuisine === "snack" ? raw(html`<a class="btn" href="${kioskUrl()}" target="_blank" rel="noopener" data-on="fallback">${K.kiosk}</a>`) : ""}
      </div>
      ${ctx.quickAdd ? raw(html`<form class="card stack" data-submit="quick" data-testid="quick-add"><b>${K.whereWent}</b>
          <input name="name" maxlength="60" placeholder="${K.whereWentPh}" autofocus>
          <button class="btn btn-primary" type="submit">${K.quickSave}</button>
          <button class="btn btn-ghost" type="button" data-on="noQuick">${K.skip}</button></form>`) : ""}
      ${book ? raw(html`<a class="btn ${st.mode === "sit" ? "btn-primary act" : ""}" href="${bookLink}" target="_blank" rel="noopener" data-testid="book">${K.book[book]}</a>`) : ""}
      ${prim === "go" ? raw(html`<button class="btn ${book && st.mode === "sit" ? "" : "btn-primary act"}" data-on="go" data-arg="${st.chosenId ?? ""}" data-testid="chosen-go">${K.go}</button>`) : prim === "roll" ? raw(html`<button class="btn btn-primary act" data-on="roll">${K.roll}</button>`) : ""}`, {
      ...common,
      cuisine: (c) => ((st.cuisine = c || null), (st.chosen = null), views.picker()),
      mode: (m) => ((st.mode = st.mode === m ? null : m), (st.chosen = null), views.picker()),
      novel: () => ((st.novel = !st.novel), (st.chosen = null), views.picker()),
      city: (c) => ((st.city = c || null), (st.chosen = null), views.picker()),
      choose: (id) => ((st.chosen = store.doc("places", id)?.name ?? null), (st.chosenId = id), views.picker()),
      roll: () => roll(scored, st),
      add: () => ((ctx.place = { name: "", city: store.get().settings.city, modes: [], foods: [], cuisines: [], price: 2, rating: 3, link: "", note: "", shabbat: false, hours: [], visits: [] }), stack.push("placeForm")),
      recipeOpen: (id) => ((ctx.recipeId = id), stack.push("recipe")),
      go: (id) => goTo(id || st.chosenId, st),
      voteToggle: (id) => {
        const sel = (st.sel ??= []);
        const i = sel.indexOf(id);
        if (i >= 0) sel.splice(i, 1);
        else if (sel.length < VOTE_MAX) sel.push(id);
        views.picker();
      },
      voteSend: () => {
        store.sendVote(st.sel ?? []).catch(saveFailed);
        ((st.sel = []), (seenPick = null));
        views.picker();
      },
      voteClear: () => (store.clearVote().catch(saveFailed), (st.sel = []), (seenPick = null), views.picker()),
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
        store.put("places", id, { name, city: st.city ?? "", modes: mode, foods: st.food ? [st.food] : [], cuisines: st.cuisine ? [st.cuisine] : food?.cuisine ?? [], price: st.budget ?? 2, rating: 3, link: "", note: "", shabbat: false, visits: [new Date().toISOString()] }).catch(saveFailed);
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
    const rollId = ctx.rollId;
    const box = document.createElement("div");
    box.className = "card chosen slot";
    box.setAttribute("aria-hidden", "true");
    root.querySelector(".topbar").after(box);
    const reduce = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const tick = () => {
      if (ctx.rollId !== rollId || !box.isConnected) return;
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
      if (h) store.put("history", ctx.entryId, { ...h, goAt: now, ...(placeId ? { place: placeId } : {}) }).catch(saveFailed);
    }
  }

  function goTo(placeId, st) {
    const p = placeId && store.doc("places", placeId);
    if (p) store.put("places", placeId, { ...p, visits: [...(p.visits ?? []), new Date().toISOString()].slice(-30) }).catch(saveFailed);
    markGoing(placeId);
    toast(K.logged);
    if (p) ((ctx.navTo = p), views.picker());
    else done();
  }

  function done() {
    ctx.pick = null;
    ctx.entryId = null;
    stack.reset("home");
  }
}
