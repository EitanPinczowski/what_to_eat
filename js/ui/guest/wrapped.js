// Guest "food wrapped" (#w=): 4-6 swipeable cards from the summary inside the link, ending in a share image
// drawn on a canvas (navigator.share with the file, download as fallback). No store, no network except the photos.
import { STR } from "../../data/strings.js";
import { QUESTIONS } from "../../data/questions.js";
import { pic, hasPic, photoSrc } from "../pics.js";
import { render, html, raw, confetti } from "../dom.js";

const W = STR.wrapped;
const BERRY = "#B0306E", SOFT = "#F3D7E6", INK = "#3A1630", BG = "#FBF6FA";

/** The cards for a summary (pure, testable). Cards without data are left out; too little data gives one friendly card. */
export function wrappedCards(s, her = "") {
  const month = W.month(s.mo);
  if (!s.enough) return [{ k: "few", title: W.fewTitle, sub: W.fewSub(month) }];
  const cards = [{ k: "intro", title: W.introTitle(her, month), sub: W.introSub(s.n) }];
  if (s.top?.length) cards.push({ k: "top", title: W.topTitle, top: s.top });
  if (s.hit !== null && s.hit !== undefined) cards.push({ k: "hit", title: W.hitTitle, big: `${s.hit}%`, sub: W.hitSub(s.hit) });
  const q = QUESTIONS.find((x) => x.id === s.q);
  if (q) cards.push({ k: "q", title: W.qTitle, big: "🤔", text: q.text, sub: W.qSub });
  if (s.pl) cards.push({ k: "place", title: W.placeTitle, big: "📍", text: s.pl, sub: W.placeSub });
  cards.push({ k: "share", title: W.shareTitle });
  return cards;
}

const foodOf = (t) => ({ id: t[0], emoji: t[2] });
const topRow = (t, i) => html`<li class="wr-top"><span class="wr-rank">${i + 1}</span><span class="wr-pic">${raw(pic(foodOf(t), "sm"))}</span><b>${t[1]}</b><small>${W.topCount(t[3])}</small></li>`;

function cardHtml(c) {
  const body = {
    intro: () => html`<div class="big" aria-hidden="true">🎁</div><h2 class="q wr-c">${c.title}</h2><p class="sub">${c.sub}</p>`,
    top: () => html`<h2 class="q wr-c">${c.title}</h2><ol class="wr-list">${c.top.map((t, i) => raw(topRow(t, i)))}</ol>`,
    hit: () => html`<h2 class="q wr-c">${c.title}</h2><div class="big wr-num">${c.big}</div><p class="sub">${c.sub}</p>`,
    q: () => html`<h2 class="q wr-c">${c.title}</h2><div class="big" aria-hidden="true">${c.big}</div><p class="wr-text">${c.text}</p><p class="sub">${c.sub}</p>`,
    place: () => html`<h2 class="q wr-c">${c.title}</h2><div class="big" aria-hidden="true">${c.big}</div><p class="wr-text">${c.text}</p><p class="sub">${c.sub}</p>`,
    few: () => html`<div class="big" aria-hidden="true">🌱</div><h2 class="q wr-c">${c.title}</h2><p class="sub">${c.sub}</p>`,
    share: () => html`<div class="big" aria-hidden="true">📤</div><h2 class="q wr-c">${c.title}</h2>
      <button class="btn btn-primary" data-on="share" data-testid="wr-share">${W.shareBtn}</button>
      <button class="btn" data-on="save">${W.saveBtn}</button>`,
  }[c.k];
  return html`<section class="card wr-card" data-k="${c.k}">${raw(body())}</section>`;
}

// ---- share image (canvas) ----
const loadImg = (src) => new Promise((res) => {
  const im = new Image();
  im.onload = () => res(im);
  im.onerror = () => res(null);
  im.src = src;
});

/** Draw the 1080x1350 share image on `canvas`. Photos where we have them, emoji otherwise. */
export async function drawShareImage(canvas, s, her = "") {
  const w = 1080, h = 1350;
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d");
  const font = "Rubik, system-ui, sans-serif";
  g.direction = "rtl";
  g.textAlign = "center";
  g.fillStyle = BG;
  g.fillRect(0, 0, w, h);
  g.fillStyle = BERRY;
  g.fillRect(0, 0, w, 300);
  g.fillStyle = "#fff";
  g.font = `800 76px ${font}`;
  g.fillText(W.introTitle(her, W.month(s.mo)), w / 2, 140, w - 120);
  g.font = `500 44px ${font}`;
  g.fillStyle = SOFT;
  g.fillText(W.imgBrand, w / 2, 230);
  let y = 400;
  for (const [i, t] of (s.top ?? []).entries()) {
    g.fillStyle = SOFT;
    g.strokeStyle = INK;
    g.lineWidth = 6;
    g.beginPath();
    g.roundRect(80, y - 80, w - 160, 170, 40);
    g.fill();
    g.stroke();
    const im = hasPic(t[0]) ? await loadImg(photoSrc(t[0], 400)) : null;
    if (im) {
      g.save();
      g.beginPath();
      g.roundRect(w - 230, y - 65, 140, 140, 28);
      g.clip();
      g.drawImage(im, w - 230, y - 65, 140, 140);
      g.restore();
    } else {
      g.font = `100px ${font}`;
      g.fillStyle = INK;
      g.fillText(t[2] || "🍽️", w - 160, y + 35);
    }
    g.fillStyle = INK;
    g.textAlign = "right";
    g.font = `800 56px ${font}`;
    g.fillText(`${i + 1}. ${t[1]}`, w - 260, y + 5, 560);
    g.font = `500 38px ${font}`;
    g.fillStyle = BERRY;
    g.fillText(W.topCount(t[3]), w - 260, y + 62);
    g.textAlign = "center";
    y += 210;
  }
  y = Math.max(y, 700) + 40;
  g.fillStyle = INK;
  if (s.hit !== null && s.hit !== undefined) {
    g.font = `800 150px ${font}`;
    g.fillText(`${s.hit}%`, w / 2, y + 100);
    g.font = `500 44px ${font}`;
    g.fillText(W.hitTitle, w / 2, y + 170, w - 120);
    y += 260;
  }
  if (s.pl) {
    g.font = `800 56px ${font}`;
    g.fillText(`📍 ${s.pl}`, w / 2, Math.min(y + 40, h - 140), w - 120);
  }
  g.fillStyle = BERRY;
  g.font = `800 40px ${font}`;
  g.fillText(`🍽️ ${W.imgBrand}`, w / 2, h - 60);
  return canvas;
}

const toBlob = (canvas) => new Promise((res) => canvas.toBlob(res, "image/png"));

/** navigator.share with the PNG when the browser can share files; otherwise download it. Returns "shared" | "saved" | "failed". */
export async function shareImage(blob, text, nav = globalThis.navigator, doc = globalThis.document) {
  if (!blob) return "failed";
  const file = new File([blob], "food-wrapped.png", { type: "image/png" });
  if (nav?.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text });
      return "shared";
    } catch (e) {
      if (e?.name === "AbortError") return "shared"; // she closed the sheet: nothing to fall back to
    }
  }
  const a = doc.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "food-wrapped.png";
  doc.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return "saved";
}

export function runWrapped(root, s, { her = s.her ?? "" } = {}) {
  const cards = wrappedCards(s, her);
  let i = 0;
  const go = (d) => {
    const n = Math.max(0, Math.min(cards.length - 1, i + d));
    if (n !== i) ((i = n), draw());
  };
  const act = async (save) => {
    try {
      const canvas = document.createElement("canvas");
      await drawShareImage(canvas, s, her);
      const blob = await toBlob(canvas);
      const r = await shareImage(blob, save ? "" : W.shareText(W.month(s.mo)), save ? null : globalThis.navigator);
      if (r === "failed") throw new Error("no image");
      confetti();
    } catch {
      const t = document.createElement("p");
      t.className = "sub";
      t.setAttribute("role", "alert");
      t.textContent = W.shareFail;
      root.querySelector(".wr-card")?.append(t);
    }
  };
  const handlers = { next: () => go(1), prev: () => go(-1), share: () => act(false), save: () => act(true) };
  function draw() {
    const c = cards[i];
    const nav = cards.length > 1
      ? html`<div class="wr-nav"><button class="btn btn-ghost" data-on="prev" ${i === 0 ? "disabled" : ""}>→ ${W.prev}</button>
          <span class="wr-dots" role="img" aria-label="${W.dots(i + 1, cards.length)}">${cards.map((_, j) => raw(j === i ? "<i class=\"on\"></i>" : "<i></i>"))}</span>
          <button class="btn btn-ghost" data-on="next" ${i === cards.length - 1 ? "disabled" : ""}>${W.next} ←</button></div>`
      : "";
    render(root, html`<div class="wr" data-testid="wrapped">${raw(cardHtml(c))}${raw(nav)}</div>`, handlers);
    const el = root.querySelector(".wr-card");
    let x0 = null;
    el?.addEventListener("pointerdown", (e) => (x0 = e.clientX));
    el?.addEventListener("pointerup", (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1); // RTL: finger moves left = next
    });
  }
  draw();
}
