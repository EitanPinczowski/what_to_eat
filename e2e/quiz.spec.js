import { test, expect } from "@playwright/test";
import { magnets } from "./helpers.js";

const ROOM = "e2eroom000000000000000000";

test("guest plays the quiz to a result (local store)", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`/?store=local#q=${ROOM}`);
  await expect(page.locator("#app h2")).toContainText("היי");
  await page.getByRole("button", { name: "יאללה, תנחש" }).click();
  await expect(page.getByTestId("qn")).toBeVisible();
  for (let i = 0; i < 40; i++) {
    if (await page.locator(".mood").count()) break;
    const yes = page.locator('[data-on="guess"][data-arg="yes"]');
    if (await yes.count()) {
      await yes.click();
      continue;
    }
    await magnets(page);
    const next = page.locator('[data-on="ans"], [data-on="gridDone"], [data-on="duel"][data-arg="a"], [data-on="gut"][data-arg="a"], [data-on="pick"]').first();
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

test("finish: choose how and budget, send, then the link says it was sent", async ({ page }) => {
  const room = "e2esend00000000000000000";
  await page.goto(`/?store=local#q=${room}`);
  await page.getByRole("button", { name: "יאללה, תנחש" }).click();
  await page.locator('[data-on="escape"]').click();
  await page.locator('input[name="food"]').fill("פיצה");
  await page.getByRole("button", { name: "זה!" }).click();
  await expect(page.locator(".title")).toHaveText("פיצה");
  await page.locator('[data-on="mode"][data-arg="delivery"]').click();
  await expect(page.locator('[data-on="mode"][data-arg="delivery"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator('[data-on="price"][data-arg="2"]').click();
  await page.locator("textarea").fill("עם זיתים");
  await page.locator('[data-on="send"]').click();
  await expect(page.getByRole("status").first()).toContainText("קיבל");
  const saved = await page.evaluate((r) => JSON.parse(localStorage.getItem(`mabalach_v1:${r}`)), room);
  const h = Object.values(saved.cols.history)[0];
  expect(h).toMatchObject({ f: "pizza", m: "delivery", price: 2, note: "עם זיתים" });
  expect(saved.cols.live.quiz.finished).toBe(true);
  await page.reload();
  await expect(page.locator(".title")).toContainText("כבר שלחת");
});

test("resume: reopening the link continues where she stopped", async ({ page }) => {
  const room = "e2eresume000000000000000";
  await page.goto(`/?store=local#q=${room}`);
  await page.getByRole("button", { name: "יאללה, תנחש" }).click();
  await page.locator('[data-on="ans"]').first().click();
  await page.locator('[data-on="ans"]').first().click();
  const q = await page.locator(".q").textContent();
  await page.reload();
  await expect(page.locator(".q")).toHaveText(q);
  await expect(page.locator('[data-on="undo"]')).toBeVisible();
});

test("feedback is saved to the room", async ({ page }) => {
  const room = "e2efeedback0000000000000";
  await page.goto(`/?store=local#q=${room}`);
  await page.getByRole("button", { name: "יאללה, תנחש" }).click();
  await page.locator('[data-on="feedback"]').click();
  await page.locator("textarea").fill("הכפתור לא עבד");
  await page.getByRole("button", { name: "שליחה" }).click();
  await expect(page.getByRole("status")).toContainText("תודה");
  const saved = await page.evaluate((r) => JSON.parse(localStorage.getItem(`mabalach_v1:${r}`)), room);
  expect(Object.values(saved.cols.feedback)[0].text).toBe("הכפתור לא עבד");
  await page.getByRole("button", { name: "חזרה" }).click();
  await expect(page.locator(".q")).toBeVisible();
});
