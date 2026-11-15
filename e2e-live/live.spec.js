// Runs only via playwright.live.config.js (separate dir, so `npm run e2e` never picks it up).
// Read-only against the deployed site: no answers are given, so nothing is written to real data.
import { test, expect } from "@playwright/test";

const SHA = process.env.LIVE_SHA ? process.env.LIVE_SHA.slice(0, 8) : "";

test("deployed sw.js carries this commit id", async ({ request }) => {
  test.skip(!SHA, "LIVE_SHA not set (local run)");
  let body = "";
  const until = Date.now() + 180000; // Pages caches; poll up to ~3 min
  while (Date.now() < until) {
    const r = await request.get(`sw.js?cb=${Date.now()}`, { headers: { "cache-control": "no-cache" } });
    body = r.ok() ? await r.text() : "";
    if (body.includes(SHA)) break;
    await new Promise((res) => setTimeout(res, 10000));
  }
  expect(body, `sw.js should contain ${SHA}`).toContain(SHA);
});

test("home loads in Hebrew with no console errors", async ({ page }) => {
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("./");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("h1")).toHaveText("מה בא לך?");
  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
});

test("a guest link renders the first Hebrew screen (not answered)", async ({ page }) => {
  await page.goto("./#q=livecheck000000000000000");
  const body = page.locator("#app");
  await expect(body).toContainText(/[֐-׿]/, { timeout: 20000 });
  expect(await body.innerText()).toMatch(/[֐-׿]{2,}/);
});
