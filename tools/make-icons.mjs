// Draws the app icons (no deps): green tile, white plate, yellow dot. Run: node tools/make-icons.mjs
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

const GREEN = [18, 133, 90], WHITE = [255, 255, 255], YELLOW = [255, 210, 63], INK = [20, 35, 27];

/** maskable: full-bleed square; otherwise rounded tile with transparent corners. */
export function png(size, { maskable = false } = {}) {
  const rows = [];
  const c = size / 2, r = size * (maskable ? 0.3 : 0.34), ring = size * 0.025, dot = size * 0.12, rad = size * 0.22;
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    for (let x = 0; x < size; x++) {
      const px = x + 0.5, py = y + 0.5;
      let a = 255;
      if (!maskable) {
        const dx = Math.max(rad - px, px - (size - rad), 0), dy = Math.max(rad - py, py - (size - rad), 0);
        if (dx * dx + dy * dy > rad * rad) a = 0;
      }
      const d = Math.hypot(px - c, py - c);
      const col = d < dot ? YELLOW : d < r - ring ? WHITE : d < r ? INK : GREEN;
      row.set([...col, a], 1 + x * 4);
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
