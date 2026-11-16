import { test, expect } from "@playwright/test";
import { openMore } from "./helpers.js";

test("owner: insights screen opens from עוד and shows its empty state with no data", async ({ page }) => {
  await page.goto("/?store=local");
  await openMore(page, "insights");
  await expect(page.getByTestId("ins-empty")).toBeVisible();
  await page.locator('[data-on="back"]').click();
  await expect(page.locator(".tiles")).toBeVisible();
});
