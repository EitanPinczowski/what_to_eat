import { test, expect } from "@playwright/test";

const ROOM = "e2eroom000000000000000000";

test("guest plays the quiz to a result (local store)", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`/?store=local#q=${ROOM}`);
  await expect(page.locator("#app h2")).toContainText("היי");
  await page.getByRole("button", { name: "יאללה, תנחש" }).click();
  await expect(page.getByRole("meter")).toBeVisible();
  for (let i = 0; i < 40; i++) {
    if (await page.locator(".mood").count()) break;
    const yes = page.locator('[data-on="guess"][data-arg="yes"]');
    if (await yes.count()) {
      await yes.click();
      continue;
    }
    const next = page.locator('[data-on="ans"], [data-on="gridDone"], [data-on="duel"][data-arg="a"], [data-on="pick"]').first();
    await next.click();
  }
  await expect(page.locator(".mood")).toBeVisible();
  await expect(page.locator(".title")).not.toBeEmpty();
  expect(errors).toEqual([]);
});

test("undo goes back a question; escape accepts free text", async ({ page }) => {
  await page.goto(`/?store=local#q=${ROOM}`);
  await page.getByRole("button", { name: "יאללה, תנחש" }).click();
  const q1 = await page.locator(".q").textContent();
  await page.locator('[data-on="ans"]').first().click();
  await expect(page.locator(".q")).not.toHaveText(q1);
  await page.locator('[data-on="undo"]').click();
  await expect(page.locator(".q")).toHaveText(q1);
  await page.locator('[data-on="escape"]').click();
  await page.locator('input[name="food"]').fill("מרק של סבתא");
  await page.getByRole("button", { name: "זה!" }).click();
  await expect(page.locator(".title")).toHaveText("מרק של סבתא");
});

test("a broken link shows a friendly error", async ({ page }) => {
  await page.goto(`/#q=<bad>`);
  await expect(page.getByRole("alert")).toContainText("שבור");
});
