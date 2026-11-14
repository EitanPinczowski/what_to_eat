import { test, expect } from "@playwright/test";

test("home page loads in Hebrew, right-to-left", async ({ page }) => {
  await page.goto("/?store=local");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("h1")).toHaveText("מה בא לך?");
  await expect(page.locator("#app")).not.toBeEmpty();
});
