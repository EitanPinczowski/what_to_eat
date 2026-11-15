import { test, expect } from "@playwright/test";

// F1: back at every quiz stage — the on-screen arrow AND the phone's back (page.goBack) undo one step, engine state included.
const START = { name: "יאללה, תנחש" };
const NEXT = '[data-on="ans"], [data-on="gridDone"], [data-on="duel"][data-arg="a"], [data-on="guess"][data-arg="no"], [data-on="pick"]';

const room = (page, id) => page.evaluate((r) => JSON.parse(localStorage.getItem(`mabalach_v1:${r}`)), id);
const liveN = async (page, id) => ((await room(page, id))?.cols?.live?.quiz?.actions ?? []).length;
const screen = async (page) => (await page.locator("#app").innerText()).replace(/\s+/g, " ");
const kind = async (page) => {
  for (const k of ["guess", "gridDone", "duel", "pick", "ans"]) if (await page.locator(`[data-on="${k}"]`).count()) return k;
  return (await page.locator(".mood").count()) ? "finish" : "other";
};

async function open(page, id, errors) {
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("about:blank");
  await page.goto(`/?store=local#q=${id}`);
  await page.getByRole("button", START).click();
}

/** From the current screen: take one step, then undo it with `how`, and the screen + step counter must be as before. */
async function stepAndBack(page, id, how) {
  const before = await screen(page);
  const nBefore = await liveN(page, id);
  const k = await kind(page);
  await page.locator(NEXT).first().click();
  await expect.poll(() => liveN(page, id)).toBe(nBefore + 1);
  if (how === "button") await page.locator('[data-on="qback"]').click();
  else await page.goBack();
  await expect.poll(() => liveN(page, id)).toBe(nBefore);
  expect(await screen(page)).toBe(before);
  expect(new URL(page.url()).origin).toBe("http://localhost:8000");
  return k;
}

test("every screen type: back button and phone back each undo exactly one step", async ({ page }) => {
  const id = "e2eback0000000000000000a";
  const errors = [];
  await open(page, id, errors);
  const tapSize = await page.locator('[data-on="qback"]').boundingBox();
  expect(tapSize.width).toBeGreaterThanOrEqual(48);
  expect(tapSize.height).toBeGreaterThanOrEqual(48);
  await expect(page.locator('[data-on="qback"]')).toHaveAttribute("aria-label", "חזרה למסך הקודם");
  const seen = new Set();
  for (let i = 0; i < 14; i++) {
    const k = await kind(page);
    if (k === "finish") break;
    seen.add(await stepAndBack(page, id, i % 2 ? "button" : "back"));
    // really advance (keeps the history entry of the step) and continue
    await page.locator(NEXT).first().click();
    await expect.poll(() => liveN(page, id)).toBe(i + 1);
  }
  for (const k of ["ans", "gridDone", "pick"]) expect(seen, `reached ${k}`).toContain(k);
  expect(errors).toEqual([]);
});

test("unsure pick of 3: 'none of these' continues the quiz, back undoes it, one tap on an option finishes", async ({ page }) => {
  const id = "e2eback0000000000000000d";
  const errors = [];
  await open(page, id, errors);
  const pickNone = page.locator('[data-on="pickNone"]');
  const advance = async () => {
    for (let i = 0; i < 30 && !(await pickNone.count()); i++) {
      const n = await liveN(page, id);
      await page.locator(NEXT).first().click();
      await expect.poll(() => liveN(page, id)).toBe(n + 1);
    }
  };
  await advance();
  await expect(pickNone).toHaveText("אף אחת מאלה");
  expect(await page.locator('[data-on="pick"]').count()).toBe(3);
  const first = await screen(page);
  const n = await liveN(page, id);
  await pickNone.click();
  await expect.poll(() => liveN(page, id)).toBe(n + 1);
  await page.locator('[data-on="qback"]').click(); // back from "none of these" shows the same 3
  await expect.poll(() => liveN(page, id)).toBe(n);
  expect(await screen(page)).toBe(first);
  await pickNone.click(); // and the quiz goes on, with different options eventually
  await expect.poll(() => liveN(page, id)).toBe(n + 1);
  await advance();
  await page.locator('[data-on="pick"]').nth(1).click();
  await expect(page.locator(".mood")).toBeVisible();
  expect(errors).toEqual([]);
});

test("hungry express shortlist: back from the pick of 3 and from the finish screen", async ({ page }) => {
  const id = "e2eback0000000000000000b";
  const errors = [];
  await open(page, id, errors);
  await page.locator('[data-on="ans"][data-arg="3"]').click(); // 🦖
  for (let i = 0; i < 12 && (await kind(page)) !== "pick"; i++) await page.locator(NEXT).first().click();
  expect(await kind(page)).toBe("pick");
  expect(await page.locator('[data-on="pick"]').count()).toBe(3);
  const pickScreen = await screen(page);
  const n = await liveN(page, id);
  // pick -> finish -> back (button) -> the same 3 again, live doc one shorter after the pick is undone
  await page.locator('[data-on="pick"]').first().click();
  await expect(page.locator(".mood")).toBeVisible();
  await expect(page.locator('[data-on="qback"]')).toBeVisible();
  await page.locator('[data-on="mode"]').first().click();
  await page.locator('[data-on="qback"]').click();
  await expect.poll(() => liveN(page, id)).toBe(n);
  expect(await screen(page)).toBe(pickScreen);
  // again with the phone back
  await page.locator('[data-on="pick"]').nth(1).click();
  await expect(page.locator(".mood")).toBeVisible();
  await page.goBack();
  await expect.poll(() => liveN(page, id)).toBe(n);
  expect(await screen(page)).toBe(pickScreen);
  // back from the very first question stays; the app is never left
  for (let i = 0; i < 40 && (await liveN(page, id)) > 0; i++) await page.locator('[data-on="qback"]').click();
  expect(await liveN(page, id)).toBe(0);
  const first = await screen(page);
  await page.locator('[data-on="qback"]').click(); // back to the intro
  await expect(page.getByRole("button", START)).toBeVisible();
  await page.goBack();
  await page.goBack();
  expect(new URL(page.url()).origin).toBe("http://localhost:8000");
  expect(page.url()).toContain("#q=");
  expect(await page.locator("#app").innerText()).toBeTruthy();
  expect(first).toBeTruthy();
  expect(errors).toEqual([]);
});

test("escape screen, free-text finish, sent screen: back closes, un-chooses, and never resends", async ({ page }) => {
  const id = "e2eback0000000000000000c";
  const errors = [];
  await open(page, id, errors);
  const q1 = await screen(page);
  await page.locator('[data-on="escape"]').click();
  await page.locator('[data-on="qback"]').click(); // escape screen -> question
  expect(await screen(page)).toBe(q1);
  await page.locator('[data-on="escape"]').click();
  await page.goBack(); // phone back closes it as well
  expect(await screen(page)).toBe(q1);
  await page.locator('[data-on="escape"]').click();
  await page.locator('input[name="food"]').fill("פיצה");
  await page.getByRole("button", { name: "זה!" }).click();
  await expect(page.locator(".title")).toHaveText("פיצה");
  await page.locator('[data-on="mode"][data-arg="delivery"]').click();
  await page.locator('[data-on="price"][data-arg="2"]').click(); // mode -> budget are on one screen: still one back = un-choose
  await page.locator('[data-on="qback"]').click();
  expect(await screen(page)).toBe(q1);
  expect(await liveN(page, id)).toBe(0);
  // send for real, then back must not undo or duplicate anything
  await page.locator('[data-on="escape"]').click();
  await page.locator('input[name="food"]').fill("פיצה");
  await page.getByRole("button", { name: "זה!" }).click();
  await page.locator('[data-on="send"]').click();
  await expect(page.getByRole("status").first()).toContainText("קיבל");
  await expect(page.locator('[data-on="qback"]')).toHaveCount(0);
  await page.goBack();
  await page.goBack();
  await expect(page.getByRole("status").first()).toContainText("קיבל");
  const saved = await room(page, id);
  expect(Object.values(saved.cols.history)).toHaveLength(1);
  expect(saved.cols.live.quiz.finished).toBe(true);
  expect(new URL(page.url()).origin).toBe("http://localhost:8000");
  expect(errors).toEqual([]);
});
