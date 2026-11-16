// The pretty result card (W4b): drawn on a canvas, no libraries. Lazy: loaded when her result appears.
// Layout leaves a band at the bottom for the couple-mode answers (opts.answers: [[label, value], ...]) once those exist.
import { STR } from "../../data/strings.js";
import { artSrc, hasPic } from "../pics.js";
import { esc } from "../dom.js";

const C = STR.card;
export const CARD = { w: 720, h: 900 };
const FONT = '"Rubik", system-ui, sans-serif';

const loadImg = (src) => new Promise((ok) => {
  const i = new Image();
  i.onload = () => ok(i);
  i.onerror = () => ok(null); // harmless: the emoji is drawn instead
  i.src = src;
});

/** Wraps text to the width, at most `max` lines. */
export function wrap(ctx, text, width, max = 3) {
  const words = String(text ?? "").split(/\s+/).filter(Boolean), lines = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (cur && ctx.measureText(t).width > width) (lines.push(cur), (cur = w));
    else cur = t;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, max);
}

/** drawCard({food, craving, answers}, canvas?) -> canvas. Colors are fixed (brand berry) so the image looks the same everywhere. */
export async function drawCard({ food, craving = "", answers = [], name = "" }, canvas = document.createElement("canvas")) {
  const { w, h } = CARD;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.fillStyle = "#FBF6FA";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#F3D7E6";
  ctx.beginPath();
  ctx.arc(w / 2, 330, 230, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#3A1630";
  ctx.strokeRect(24, 24, w - 48, h - 48);
  ctx.fillStyle = "#B0306E";
  ctx.font = `800 40px ${FONT}`;
  ctx.fillText(C.title, w / 2, 100);
  const img = food && hasPic(food.id) ? await loadImg(artSrc(food.id)) : null;
  if (img) ctx.drawImage(img, w / 2 - 170, 160, 340, 340);
  else {
    ctx.font = "260px system-ui, sans-serif";
    ctx.fillText(food?.emoji ?? "🍽️", w / 2, 420);
  }
  ctx.fillStyle = "#3A1630";
  ctx.font = `800 64px ${FONT}`;
  ctx.fillText(food?.name ?? name, w / 2, 590);
  ctx.fillStyle = "#7A4F68";
  ctx.font = `500 34px ${FONT}`;
  wrap(ctx, craving, w - 160).forEach((l, i) => ctx.fillText(l, w / 2, 655 + i * 46));
  answers.slice(0, 3).forEach(([k, v], i) => { // couple mode, later: his answers
    ctx.fillStyle = "#3A1630";
    ctx.font = `500 30px ${FONT}`;
    ctx.fillText(`${k}: ${v}`, w / 2, 810 + i * 38);
  });
  return canvas;
}

export const toBlob = (canvas) => new Promise((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error("no blob"))), "image/png"));

export function download(blob, name = C.file) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/** Shares the image when the browser can share files, otherwise downloads it. Resolves "shared" or "saved". */
export async function shareOrSave(blob, text, nav = globalThis.navigator, save = download) {
  const file = new File([blob], C.file, { type: "image/png" });
  if (nav?.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text });
      return "shared";
    } catch (e) {
      if (e?.name === "AbortError") return "shared"; // she closed the sheet: nothing more to do
    }
  }
  save(blob);
  return "saved";
}

/** Adds the two buttons under the result. The image is drawn on the first tap, not before. */
export function mountCard(host, out) {
  if (!host || !out?.food) return;
  const his = out.answers?.length ? `<p class="sub his" data-testid="his"><b>${esc(out.hisBy ?? "")}</b> ${out.answers.map(([, v]) => `<span class="chip">${esc(v)}</span>`).join(" ")}</p>` : "";
  host.innerHTML = `${his}<div class="duel card-btns"><button class="btn" data-testid="card-save">${C.save}</button><button class="btn" data-testid="card-share">${C.whatsapp}</button></div>`;
  const run = (fn) => async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    try {
      const blob = await toBlob(await drawCard({ food: out.food, craving: out.craving, answers: out.answers }));
      await fn(blob);
    } catch {
      b.textContent = C.failed;
    }
    b.disabled = false;
  };
  host.querySelector("[data-testid=card-save]").addEventListener("click", run((b) => download(b)));
  host.querySelector("[data-testid=card-share]").addEventListener("click", run((b) => shareOrSave(b, C.shareText(out.food.name))));
}
