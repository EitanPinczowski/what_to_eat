import { test, expect } from "@playwright/test";
import { openMore } from "./helpers.js";

test("owner: stats card in history and the 'how was it?' prompt", async ({ page }) => {
  await page.goto("/?store=local");
  await expect(page.locator(".tile")).toHaveCount(4);
  const room = await page.evaluate(() => localStorage.getItem("mabalach_room"));
  await page.evaluate((room) => {
    const key = `mabalach_v1:${room}`;
    const d = JSON.parse(localStorage.getItem(key));
    const old = new Date(Date.now() - 3 * 3600e3).toISOString();
    d.cols.history = {
      h1: { at: old, f: "pizza", fn: "פיצה", fe: "🍕", m: "delivery", goAt: old, stats: { hit: true, steps: 9, skips: ["temp"] }, trail: [] },
      h2: { at: old, f: "sushi", fn: "סושי", fe: "🍣", m: "sit", stats: { hit: false, steps: 13, skips: ["temp"] }, trail: [] },
    };
    localStorage.setItem(key, JSON.stringify(d));
  }, room);
  await page.reload();
  await expect(page.getByTestId("how")).toContainText("פיצה");
  await page.locator('[data-on="how"]').first().click();
  await expect(page.getByTestId("how")).toHaveCount(0);
  const exp = await page.evaluate((room) => JSON.parse(localStorage.getItem(`mabalach_v1:${room}`)).room.exp, room);
  expect(exp.pizza).toBe(0.5);
  await openMore(page, "history");
  await expect(page.getByTestId("stats")).toContainText("50%");
  await expect(page.getByTestId("stats")).toContainText("11.0");
  await expect(page.getByTestId("stats")).toContainText("חם או קר?");
});
