import { test, expect } from "@playwright/test";
import { openMore, pickCategory } from "./helpers.js";

test("owner: home tiles, send-quiz link, live status from her tab, toast on result", async ({ page, context }) => {
  await page.goto("/?store=local");
  await expect(page.locator(".tile")).toHaveCount(3);
  await page.locator('[data-on="go"][data-arg="send"]').click();
  const link = await page.locator("code.link").textContent();
  expect(link).toMatch(/#q=[a-z0-9]{24}$/);
  await expect(page.locator("a.btn-primary")).toHaveAttribute("href", /^https:\/\/wa\.me\/\?text=/);
  await expect(page.getByTestId("live")).toHaveText("עוד לא נפתח");

  // Her tab (same browser storage → storage events reach the owner tab).
  const her = await context.newPage();
  await her.goto(link.replace("#", "?store=local#"));
  await expect(page.getByTestId("live")).toContainText("פתחה");
  await her.getByRole("button", { name: "יאללה, תנחש" }).click();
  await pickCategory(her);
  await her.locator('[data-on="ans"]').first().click();
  await expect(page.getByTestId("live")).toContainText("שאלה 1");
  await her.locator('[data-on="escape"]').click();
  await her.locator('input[name="food"]').fill("סושי");
  await her.getByRole("button", { name: "זה!" }).click();
  await her.locator('[data-on="send"]').click();
  await expect(her.getByRole("status").first()).toContainText("קיבל");
  await expect(page.locator(".toast")).toContainText("סושי");
  await expect(page.getByTestId("live")).toContainText("סיימה");

  await page.locator('[data-on="back"]').click();
  await openMore(page, "history");
  await expect(page.locator(".hist")).toHaveCount(1);
  await expect(page.locator(".hist b")).toHaveText("סושי");
});

test("owner: she's-next-to-me quiz saves to history", async ({ page }) => {
  await page.goto("/?store=local");
  await page.locator('[data-on="go"][data-arg="local"]').click();
  await expect(page.locator(".q")).toBeVisible();
  await page.locator('[data-on="escape"]').click();
  await page.locator('input[name="food"]').fill("חומוס");
  await page.getByRole("button", { name: "זה!" }).click();
  await page.locator('[data-on="send"]').click();
  await expect(page.locator(".last .title")).toHaveText("חומוס");
  await expect(page.locator(".toast")).toHaveCount(1);
});

test("owner: #r= fallback link imports once", async ({ page }) => {
  const payload = { v: 1, t: "quiz", id: "fallback1", at: "2026-11-01T12:00:00Z", f: "falafel", fn: "פלאפל", fe: "🧆", m: "take", trail: [] };
  const enc = Buffer.from(JSON.stringify(payload)).toString("base64url");
  page.on("dialog", (d) => d.accept()); // #r= imports ask first
  await page.goto(`/?store=local#r=${enc}`);
  await expect(page.locator(".toast")).toContainText("נקלטה");
  await expect(page.locator(".last .title")).toHaveText("פלאפל");
  expect(new URL(page.url()).hash).toBe("");
  await page.goto(`/?store=local#r=${enc}`);
  await expect(page.locator(".toast")).toContainText("כבר");
});
