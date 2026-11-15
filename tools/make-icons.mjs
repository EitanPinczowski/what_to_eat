// Draws the app icons (no deps): berry tile, plate with a heart, fork + spoon crossed behind it.
// Flat "pop" style: ink outlines, offset ink shadow, supersampled anti-aliasing. Run: node tools/make-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};

const BERRY = [176, 48, 110], WHITE = [255, 255, 255], SOFT = [243, 215, 230], INK = [58, 22, 48], BG = [251, 246, 250]; // berry tokens (css/tokens.css)

// ---- signed-distance helpers (negative inside), units are fractions of the icon size, origin at centre ----
const circle = (x, y, cx, cy, r) => Math.hypot(x - cx, y - cy) - r;
const box = (x, y, cx, cy, hw, hh) => {
  const dx = Math.abs(x - cx) - hw, dy = Math.abs(y - cy) - hh;
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0);
};
const ellipse = (x, y, cx, cy, rx, ry) => (Math.hypot((x - cx) / rx, (y - cy) / ry) - 1) * Math.min(rx, ry);
const unionD = (...d) => Math.min(...d);
// heart: exact-ish signed distance of the classic heart curve; tip at (cx, tipY), width ~ size
const heart = (x, y, cx, tipY, size) => {
  const px = Math.abs(x - cx) / size, py = (tipY - y) / size;
  const d2 = (a, b) => a * a + b * b;
  let d;
  if (py + px > 1) d = Math.sqrt(d2(px - 0.25, py - 0.75)) - Math.SQRT2 / 4;
  else {
    const m = 0.5 * Math.max(px + py, 0);
    d = Math.sqrt(Math.min(d2(px, py - 1), d2(px - m, py - m))) * Math.sign(px - py);
  }
  return d * size;
};
// local frame along a diagonal axis: (t = along towards head, n = across)
const frame = (x, y, ang) => {
  const ax = Math.sin(ang), ay = -Math.cos(ang); // unit axis pointing up-and-out (ang from vertical)
  return [x * ax + y * ay, -x * ay + y * ax];
};
const forkD = (x, y, ang) => {
  const [t, n] = frame(x, y, ang);
  return unionD(
    box(t, n, -0.06, 0, 0.30, 0.028),          // handle
    box(t, n, 0.27, 0, 0.025, 0.082),          // head base
    box(t, n, 0.325, -0.06, 0.05, 0.016),      // tines
    box(t, n, 0.325, 0, 0.05, 0.016),
    box(t, n, 0.325, 0.06, 0.05, 0.016),
  );
};
const spoonD = (x, y, ang) => {
  const [t, n] = frame(x, y, ang);
  return unionD(box(t, n, -0.06, 0, 0.30, 0.028), ellipse(t, n, 0.30, 0, 0.085, 0.07));
};

/** Colour at (x,y) in icon-centred unit coords. */
function scene(x, y, { maskable }) {
  let col = maskable ? BERRY : BERRY;
  const OL = 0.014, SH = 0.014; // outline width, shadow offset
  const layer = (d, fill, dShadow) => {
    if (dShadow !== undefined && dShadow < OL) col = INK; // offset shadow
    if (d < 0) col = fill;
    else if (d < OL) col = INK;
  };
  const sd = (fn) => fn(x - SH, y - SH);
  const ANG = Math.PI / 4;
  // fork (head up-left) and spoon (head up-right) crossed behind the plate
  const fk = (px, py) => forkD(px, py, -ANG), sp = (px, py) => spoonD(px, py, ANG);
  layer(fk(x, y), WHITE, sd(fk));
  layer(sp(x, y), WHITE, sd(sp));
  // plate
  const pl = (px, py) => circle(px, py, 0, 0.01, 0.235);
  layer(pl(x, y), WHITE, sd(pl));
  const rim = Math.abs(circle(x, y, 0, 0.01, 0.185));
  if (rim < 0.006) col = SOFT;
  // heart
  const ht = (px, py) => heart(px, py, 0, 0.115, 0.215);
  layer(ht(x, y), BERRY, undefined);
  // shine on the heart
  if (circle(x, y, -0.045, -0.03, 0.013) < 0 && ht(x, y) < -0.012) col = SOFT;
  return col;
}

/** maskable: full-bleed square; otherwise rounded tile with transparent corners. */
export function png(size, { maskable = false } = {}) {
  const rows = [];
  const rad = size * 0.22, k = maskable ? 0.9 : 1.08, N = 3;
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < N; sy++) for (let sx = 0; sx < N; sx++) {
        const px = x + (sx + 0.5) / N, py = y + (sy + 0.5) / N;
        let cov = 1;
        if (!maskable) {
          const dx = Math.max(rad - px, px - (size - rad), 0), dy = Math.max(rad - py, py - (size - rad), 0);
          if (dx * dx + dy * dy > rad * rad) cov = 0;
        }
        const c = scene((px / size - 0.5) / k, (py / size - 0.5) / k, { maskable });
        r += c[0] * cov; g += c[1] * cov; b += c[2] * cov; a += cov;
      }
      const n = N * N;
      row.set(a ? [Math.round(r / a), Math.round(g / a), Math.round(b / a), Math.round((a / n) * 255)] : [0, 0, 0, 0], 1 + x * 4);
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}` || process.argv[1]?.endsWith("make-icons.mjs")) {
  mkdirSync("img/icons", { recursive: true });
  writeFileSync("img/icons/icon-192.png", png(192));
  writeFileSync("img/icons/icon-512.png", png(512));
  writeFileSync("img/icons/maskable-512.png", png(512, { maskable: true }));
  writeFileSync("img/icons/apple-180.png", png(180, { maskable: true })); // iOS rounds the corners itself
  console.log("icons written to img/icons");
}
