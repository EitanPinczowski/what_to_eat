import { test, expect } from "@playwright/test";
import { magnets, pickCategory } from "./helpers.js";

test("couple mode: he answers, she answers, she sees his answers only at the end", async ({ page, context }) => {
  await page.goto("/?store=local");
  await page.locator('[data-on="go"][data-arg="send"]').click();
  await page.getByTestId("couple-toggle").click();
  await expect(page.getByTestId("couple-q")).toHaveCount(3);
  await page.getByRole("button", { name: "🍟 מלוח ושמנוני" }).click();
  await page.getByRole("button", { name: "😴 מלא ומרוצה" }).click();
  await expect(page.getByRole("button", { name: "🍟 מלוח ושמנוני" })).toHaveAttribute("aria-pressed", "true");
  const link = await page.locator("code.link").textContent();

  const her = await context.newPage();
  await her.goto(link.replace("#", "?store=local#"));
  await her.getByRole("button", { name: "יאללה, תנחש" }).click();
  await pickCategory(her);
  await expect(her.getByTestId("qn")).toBeVisible();
  for (let i = 0; i < 40; i++) {
    if (await her.locator(".mood").count()) break;
    await expect(her.getByTestId("his")).toHaveCount(0); // hidden while she answers
    await expect(her.locator("#app")).not.toContainText("איתן ענה");
    const yes = her.locator('[data-on="guess"][data-arg="yes"]');
    if (await yes.count()) {
      await yes.click();
      continue;
    }
    await magnets(her);
    await her.locator('[data-on="cat"], [data-on="ans"], [data-on="gridDone"], [data-on="duel"][data-arg="a"], [data-on="gut"][data-arg="a"], [data-on="pick"]').first().click();
  }
  await expect(her.locator(".mood")).toBeVisible();
  const his = her.getByTestId("his");
  await expect(his).toContainText("ענה:");
  await expect(his).toContainText("🍟 מלוח ושמנוני");
  await expect(his).toContainText("😴 מלא ומרוצה");
});
