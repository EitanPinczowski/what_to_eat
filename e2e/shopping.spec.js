import { test, expect } from "@playwright/test";

test("cook: recipe options, add to the shopping list, tick and clear", async ({ page }) => {
  const p = { v: 1, t: "quiz", id: "cook1", f: "shakshuka", fn: "שקשוקה", fe: "🍳", m: "home", price: null, trail: [] };
  await page.goto(`/?store=local#r=${Buffer.from(JSON.stringify(p)).toString("base64url")}`);
  await page.locator('[data-on="go"][data-arg="history"]').click();
  await page.locator('[data-on="pickFor"]').click();
  await expect(page.getByTestId("recipes")).toContainText("שקשוקה קלאסית");
  await page.locator('[data-on="recipeOpen"]').first().click();
  await page.getByTestId("add-shopping").click();
  await expect(page.getByTestId("add-shopping")).toBeDisabled();
  await page.locator('[data-on="go"][data-arg="shopping"]').click();
  await expect(page.locator(".shoplist li")).toHaveCount(8);
  await expect(page.locator(".shoplist")).toContainText("4 ביצים");
  await page.locator('input[data-input="tick"]').first().check();
  await page.getByTestId("shop-clear").click();
  await expect(page.locator(".shoplist li")).toHaveCount(7);
});
