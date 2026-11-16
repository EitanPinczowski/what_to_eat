// Item 33d: the owner app opens on data saved by older versions (fixtures in tests/fixtures/old-data.js) and every screen draws.
import { test, expect } from "@playwright/test";
import { oldLocalRecord, OLD_ROOMS } from "../tests/fixtures/old-data.js";
import { openMore } from "./helpers.js";

const ROOM = "e2eolddata0000000000000000";

async function open(page, record) {
  await page.addInitScript(
    ([room, record]) => {
      if (sessionStorage.getItem("seeded")) return; // seed once, not again on reload
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("mabalach_room", room);
      if (record !== null) localStorage.setItem(`mabalach_v1:${room}`, JSON.stringify(record));
    },
    [ROOM, record],
  );
  await page.goto("/?store=local");
  await page.locator(".tile").first().waitFor();
}

test("owner app on an old full record: every screen draws, no errors", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page, oldLocalRecord());
  for (const key of ["history", "places", "brain", "picker", "shopping", "insights", "settings"]) {
    const direct = page.locator(`[data-on="go"][data-arg="${key}"]`);
    if (await direct.count()) await direct.first().click();
    else await openMore(page, key);
    await expect(page.locator("#app")).toContainText(/\S/);
    await expect(page.locator('[data-on="back"]').first()).toBeVisible();
    await page.locator('[data-on="back"]').first().click();
    await page.locator(".tile").first().waitFor();
    // from a "more" list, back lands on that list: go home if the home tiles are not there
    if (!(await page.locator('[data-on="go"][data-arg="more"]').count())) await page.locator('[data-on="back"]').first().click();
  }
  expect(errors).toEqual([]);
});

for (const [i, room] of OLD_ROOMS.entries()) {
  test(`owner app on old room doc shape #${i}`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await open(page, { room, cols: {} });
    await expect(page.locator("h1")).toHaveText("מה בא לך?");
    expect(errors).toEqual([]);
  });
}

test("owner app on damaged storage content shows the home screen, not a blank page", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(
    ([room]) => {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("mabalach_room", room);
      localStorage.setItem(`mabalach_v1:${room}`, "{not json");
    },
    [ROOM],
  );
  await page.goto("/?store=local");
  await expect(page.locator("h1")).toHaveText("מה בא לך?");
  await expect(page.locator("#app")).not.toBeEmpty();
  expect(errors).toEqual([]);
});
