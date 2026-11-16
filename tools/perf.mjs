// Load-speed probe: Pixel-like phone, CPU 4x slower, slow 4G. Time to the first meaningful screen.
//   node tools/perf.mjs            (needs `npm run serve` on :8000, or PORT=...)
// Scenarios: Noga's quiz link (first screen = intro title) and Eitan's owner home (tiles), cold and warm (service worker).
// Uses ?store=local so Firebase is not involved (it is not reachable from a test run); open-meteo is delayed 1.5 s to show weather waits.
import { chromium, devices } from "@playwright/test";

const base = `http://localhost:${process.env.PORT || 8000}/`;
const RUNS = Number(process.env.RUNS || 3);
const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

async function setup(browser) {
  const ctx = await browser.newContext({ ...devices["Pixel 7"], locale: "he-IL" });
  await ctx.route("**/api.open-meteo.com/**", async (r) => {
    await new Promise((s) => setTimeout(s, 1500));
    r.fulfill({ json: { current: { temperature_2m: 22, precipitation: 0 } } });
  });
  await ctx.route("**/geocoding-api.open-meteo.com/**", (r) => r.fulfill({ json: { results: [] } }));
  await ctx.route("**/fonts.g*apis.com/**", (r) => r.abort());
  return ctx;
}

async function throttle(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
}

async function once(browser, kind, warm) {
  const ctx = await setup(browser);
  const page = await ctx.newPage();
  let bytes = 0, reqs = 0;
  page.on("response", async (r) => { reqs++; try { bytes += (await r.body()).length; } catch {} });
  const hash = kind === "quiz" ? "#q=abcdefghijklmnopqrstuvwx" : "";
  const sel = kind === "quiz" ? "h2.title" : ".tiles .tile";
  const url = `${base}?store=local&sw${hash}`;
  if (warm) {
    await page.goto(url);
    await page.waitForSelector(sel, { timeout: 60000 });
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForTimeout(3000); // let the install finish precaching
    await page.evaluate(() => new Promise((r) => (navigator.serviceWorker.controller ? r() : navigator.serviceWorker.addEventListener("controllerchange", r))));
  }
  await throttle(page);
  reqs = 0; bytes = 0;
  await page.goto("about:blank");
  await page.goto(url);
  await page.waitForSelector(sel, { timeout: 120000 });
  const t = await page.evaluate(() => performance.now());
  await ctx.close();
  return { t, reqs, kb: Math.round(bytes / 1024) };
}

const browser = await chromium.launch();
const rows = [];
for (const kind of ["quiz", "owner"])
  for (const warm of [false, true]) {
    const rs = [];
    for (let i = 0; i < RUNS; i++) rs.push(await once(browser, kind, warm));
    rows.push(`${kind.padEnd(6)} ${warm ? "warm" : "cold"}  ${Math.round(med(rs.map((r) => r.t)))} ms   ${rs[0].reqs} requests  ${rs[0].kb} KB`);
  }
await browser.close();
console.log(rows.join("\n"));
