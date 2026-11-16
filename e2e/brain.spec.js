import { test, expect } from "@playwright/test";
import { openMore } from "./helpers.js";

test("brain: rate, filter, note, inbox → custom food", async ({ page }) => {
  // Seed an inbox item through a #r= free-text result.
  const p = { v: 1, t: "quiz", id: "brain1", f: null, fn: "מרק של סבתא", fe: "🍲", trail: [] };
  page.on("dialog", (d) => d.accept()); // #r= imports ask first
  await page.goto(`/?store=local#r=${Buffer.from(JSON.stringify(p)).toString("base64url")}`);
  await openMore(page, "brain");
  await expect(page.locator(".inbox")).toContainText("מרק של סבתא");

  await page.locator('input[type="search"]').fill("במבה");
  await expect(page.locator("li.row")).toHaveCount(1);
  await page.locator('[data-on="rate"][data-arg="bamba:4"]').click();
  await expect(page.locator('[data-on="rate"][data-arg="bamba:4"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator('input[type="search"]').fill("");
  await page.locator('[data-on="filter"][data-arg="4"]').click();
  await expect(page.locator("li.row")).toHaveCount(1);

  await page.locator('[data-on="open"][data-arg="bamba"]').click();
  await page.locator("textarea").fill("רק נוגט");
  await page.getByRole("button", { name: "שמירה" }).click();
  await expect(page.locator("li.row")).toContainText("📝");

  await page.locator('[data-on="addInbox"]').click();
  await expect(page.locator('[data-input="name"]')).toHaveValue("מרק של סבתא");
  await page.locator('[data-input="emoji"]').fill("🍲");
  await page.locator('[data-on="tag"][data-arg="hot"]').click();
  await page.locator('[data-on="tag"][data-arg="comfort"]').click();
  await page.getByRole("button", { name: "שמירה" }).click();
  await expect(page.locator(".inbox")).toHaveCount(0);
  await page.locator('[data-on="filter"][data-arg="4"]').click();
  await page.locator('input[type="search"]').fill("סבתא");
  await expect(page.locator("li.row")).toContainText("שלי");
});
