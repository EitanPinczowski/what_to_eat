import { test, expect } from "@playwright/test";

const seedResult = (id) => {
  const p = { v: 1, t: "quiz", id, f: "falafel", fn: "פלאפל", fe: "🧆", m: "take", trail: [] };
  return `/?store=local#r=${Buffer.from(JSON.stringify(p)).toString("base64url")}`;
};

test("settings: names and phones, paste a result link, backup reminder + export, rotate key", async ({ page }) => {
  await page.goto(seedResult("s1"));
  await expect(page.getByTestId("backup")).toBeVisible();
  await page.getByTestId("backup").click();
  await page.locator('input[name="her"]').fill("נוגה");
  await page.locator('input[name="herPhone"]').fill("050-000-0000");
  await page.getByRole("button", { name: "שמירה" }).click();
  await expect(page.locator('input[name="herPhone"]')).toHaveValue("972500000000");

  const p2 = { v: 1, t: "quiz", id: "s2", f: "sushi", fn: "סושי", fe: "🍣", trail: [] };
  await page.locator('input[name="link"]').fill(`https://x.io/#r=${Buffer.from(JSON.stringify(p2)).toString("base64url")}`);
  await page.getByRole("button", { name: "ייבוא" }).click();
  await expect(page.locator(".toast").last()).toContainText("נקלטה");

  const download = page.waitForEvent("download");
  await page.locator('[data-on="export"]').click();
  expect((await download).suggestedFilename()).toMatch(/^mabalach-backup-\d{4}-\d\d-\d\d\.json$/);

  const oldRoom = await page.evaluate(() => localStorage.getItem("mabalach_room"));
  page.on("dialog", (d) => d.accept());
  await page.locator('[data-on="rotate"]').click();
  await expect(page.locator(".tiles")).toBeVisible();
  const newRoom = await page.evaluate(() => localStorage.getItem("mabalach_room"));
  expect(newRoom).not.toBe(oldRoom);
  await expect(page.getByTestId("backup")).toHaveCount(0);
  await expect(page.locator(".last .title")).toHaveText("סושי");
  await page.locator('[data-on="go"][data-arg="send"]').click();
  await expect(page.locator("a.btn-primary")).toHaveAttribute("href", /wa\.me\/972500000000/);
  await expect(page.locator("code.link")).toContainText(newRoom);
});

test("join link over an existing room asks first; declining keeps the room, accepting keeps a backup key", async ({ page }) => {
  await page.goto("/?store=local");
  await expect(page.locator(".tiles")).toBeVisible();
  const mine = await page.evaluate(() => localStorage.getItem("mabalach_room"));
  let dialogs = 0;
  page.once("dialog", (d) => (dialogs++, d.dismiss()));
  await page.goto("/?store=local#join=abcdefghij1234567890abcd");
  await expect(page.locator(".tiles")).toBeVisible();
  expect(dialogs).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem("mabalach_room"))).toBe(mine);
  page.once("dialog", (d) => d.accept());
  await page.goto("/?store=local#join=abcdefghij1234567890abcd");
  await expect(page.locator(".tiles")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("mabalach_room"))).toBe("abcdefghij1234567890abcd");
  expect(await page.evaluate(() => localStorage.getItem("mabalach_prev_room"))).toBe(mine);
});
