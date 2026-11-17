// Item 33b: screenshot comparison of about 10 key screens (Pixel only). Local store, fixed clock, seeded Math.random,
// network stubbed, animations off, dynamic parts masked. Baselines are per platform (-win32 / -linux suffix, Playwright default):
//  - on CI (`CI` set) a missing baseline is written and the run passes (CI uploads them as an artifact to be committed);
//  - elsewhere a screen without a baseline for this platform is skipped, so no machine goes red for lack of one.
import { test, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import { openMore, pickCategory } from "./helpers.js";

test.beforeEach(({}, ti) => test.skip(ti.project.name !== "pixel", "screenshots: Pixel project only"));

const ROOM = "e2eshots0000000000000000";
const NOW = new Date("2026-11-16T10:00:00+02:00");
const iso = (d) => new Date(NOW.getTime() - d * 864e5).toISOString();
const prevMo = "2026-10";

async function setup(page, scheme = "light") {
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
  await page.route(/open-meteo\.com/, (r) =>
    r.request().url().includes("geocoding")
      ? r.fulfill({ json: { results: [{ latitude: 32.18, longitude: 34.87 }] } })
      : r.fulfill({ json: { current: { temperature_2m: 21, precipitation: 0 } } }),
  );
  await page.route(/ntfy\.sh|wte-push|gstatic|googleapis|firebase|fonts\./, (r) => r.fulfill({ status: 200, body: "{}" }));
  await page.clock.setFixedTime(NOW);
  await page.addInitScript(() => {
    let s = 12345; // seeded Math.random: the question order is stable
    Math.random = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  });
}

async function seed(page) {
  await page.goto("/?store=local");
  const room = await page.evaluate(() => localStorage.getItem("mabalach_room"));
  await page.evaluate(
    ([room, prevMo, now]) => {
      const k = `mabalach_v1:${room}`;
      const d = JSON.parse(localStorage.getItem(k) ?? "null") ?? { room: { settings: {} }, cols: Object.fromEntries(["history", "places", "live", "feedback", "errors", "shopping"].map((c) => [c, {}])) };
      const mk = (id, f, fn, fe, at, extra = {}) =>
        (d.cols.history[id] = { id, f, fn, fe, at, m: "take", price: 2, trail: ["שאלה 1", "שאלה 2"], stats: { hit: true, guesses: 1, steps: 6 }, ...extra });
      mk("h1", "falafel", "פלאפל", "🧆", now[0], { note: "היה מעולה" });
      mk("h2", "sushi", "סושי", "🍣", now[1], { m: "delivery", goAt: now[1] });
      mk("h3", "pizza", "פיצה", "🍕", prevMo + "-10T12:00:00Z");
      mk("h5", "sushi", "סושי", "🍣", prevMo + "-14T12:00:00Z", { stats: { hit: false, guesses: 2, steps: 9 } });
      d.cols.places ||= {};
      const pl = (id, name, modes, foods, price, rating, extra = {}) =>
        (d.cols.places[id] = { id, name, city: "רעננה", modes, foods, price, rating, link: "", note: "", shabbat: false, hours: [], visits: [], ...extra });
      pl("p1", "פיצה של רפי", ["delivery", "take"], ["pizza"], 2, 4);
      pl("p2", "סושי בר", ["sit", "delivery"], ["sushi"], 3, 5);
      d.room = d.room ?? { settings: {} };
      d.room.settings = { ...d.room.settings, city: "רעננה" };
      localStorage.setItem(k, JSON.stringify(d));
    },
    [room, prevMo, [iso(1), iso(3)]],
  );
  await page.reload();
  await page.locator(".tile").first().waitFor();
}

async function go(page, arg) {
  const t = page.locator(`[data-on="go"][data-arg="${arg}"]`);
  if (!(await t.count()) && !(await page.locator('[data-arg="more"]').count())) await page.locator('[data-on="back"]').click(); // on the "more" list: back home first
  if (await t.count()) return t.first().click();
  await openMore(page, arg);
}

async function snap(page, name, opts = {}) {
  const ti = test.info();
  if (!process.env.CI && ti.config.updateSnapshots === "none" && !existsSync(ti.snapshotPath(`${name}.png`))) test.skip(true, `no ${process.platform} baseline for ${name}`);
  await page.evaluate(() => document.fonts?.ready);
  await expect(page).toHaveScreenshot(`${name}.png`, {
    animations: "disabled",
    caret: "hide",
    fullPage: true,
    maxDiffPixelRatio: 0.03,
    mask: [page.locator(".confetti, .toast, .save-status, [data-dyn], .live-line, time")],
    ...opts,
  });
}

test("guest welcome", async ({ page }) => {
  await setup(page);
  await page.goto(`/?store=local#q=${ROOM}`);
  await page.getByRole("button", { name: "יאללה, תנחש" }).waitFor();
  await snap(page, "guest-welcome");
});

test("guest first question", async ({ page }) => {
  await setup(page);
  await page.goto(`/?store=local#q=${ROOM}`);
  await page.getByRole("button", { name: "יאללה, תנחש" }).click();
  await pickCategory(page);
  await page.locator(".q").waitFor();
  await snap(page, "guest-question");
});

test("guest free text", async ({ page }) => {
  await setup(page);
  await page.goto(`/?store=local#q=${ROOM}`);
  await page.getByRole("button", { name: "יאללה, תנחש" }).click();
  await pickCategory(page);
  await page.locator('[data-on="escape"]').click();
  await page.locator('input[name="food"]').waitFor();
  await snap(page, "guest-free-text");
});

test("owner home, empty", async ({ page }) => {
  await setup(page);
  await page.goto("/?store=local");
  await page.locator(".tile").first().waitFor();
  await snap(page, "owner-home-empty");
});

test("owner home with history, light and dark", async ({ page }) => {
  await setup(page);
  await seed(page);
  await snap(page, "owner-home-light");
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await snap(page, "owner-home-dark");
});

test("owner screens: send, history, places, picker, brain, settings", async ({ page }) => {
  await setup(page);
  await seed(page);
  for (const [arg, name] of [["send", "send"], ["history", "history"], ["places", "places"], ["picker", "picker"], ["brain", "brain"], ["settings", "settings"]]) {
    await go(page, arg);
    await page.locator("#app h2, #app h1, #app .topbar").first().waitFor();
    await page.waitForTimeout(300);
    await snap(page, `owner-${name}`);
    await page.locator('[data-on="back"]').first().click();
    await page.locator(".tile, [data-arg=\"more\"]").first().waitFor();
  }
});
