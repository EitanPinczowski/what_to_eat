import { test, expect } from "@playwright/test";
import { openMore } from "./helpers.js";

test("sweep: owner sends, she rates (tap, skip, swipe, undo), extras reach the inbox", async ({ page, context }) => {
  await page.goto("/?store=local");
  await openMore(page, "sweep");
  const link = await page.locator("code.link").textContent();
  expect(link).toMatch(/#s=[a-z0-9]{24}$/);

  const her = await context.newPage();
  await her.goto(link.replace("#", "?store=local#"));
  await her.getByRole("button", { name: "יאללה" }).click();
  const first = await her.locator(".sweep-card .title").textContent();
  await her.locator('[data-on="rate"][data-arg="4"]').click();
  await expect(page.getByTestId("sweep-live")).toContainText("דירגה 1");
  await her.locator('[data-on="skip"]').click();
  await expect(her.locator(".pile")).toContainText("דילגת: 1");
  await her.locator('[data-on="undo"]').click();
  await expect(her.locator(".pile")).toContainText("דילגת: 0");
  const third = await her.locator(".sweep-card .title").textContent();
  const box = await her.locator(".sweep-card").boundingBox();
  await her.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await her.mouse.down();
  await her.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 5 });
  await her.mouse.up();
  await expect(her.locator(".sweep-card .title")).not.toHaveText(third);
  await her.locator('[data-on="finish"]').click();
  await her.locator("textarea").fill("מרק עוף של אמא, קובה");
  await her.locator('button[type="submit"]').click();
  await expect(her.getByRole("status")).toContainText("קיבל");
  await expect(page.getByTestId("sweep-live")).toContainText("סיימה");

  await page.locator('[data-on="back"]').click();
  await openMore(page, "brain");
  await expect(page.locator(".inbox")).toContainText("מרק עוף של אמא");
  await page.locator('input[type="search"]').fill(first);
  // Her food's own row (the brain screen is grouped since item 28, so the first match may be another food); her rating syncs a little after "סיימה".
  await expect(page.locator("li.row", { hasText: first }).first().locator('[aria-pressed="true"]')).toHaveText("😍", { timeout: 15000 });
});
