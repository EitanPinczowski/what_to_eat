// Item 33g: error paths. A failed write, a failed weather fetch, no network and a failed Firebase start each end in a toast
// or a fallback screen, never a blank page and never an uncaught error.
import { test, expect } from "@playwright/test";
import { openMore } from "./helpers.js";

const GUEST = "e2eerrors000000000000000";

const noBlank = async (page) => {
  await expect(page.locator("#app")).not.toBeEmpty();
  await expect(page.locator("#app")).toContainText(/\S/);
};

async function playToResult(page) {
  for (let i = 0; i < 40 && !(await page.locator(".mood").count()); i++) {
    const yes = page.locator('[data-on="guess"][data-arg="yes"]');
    if (await yes.count()) await yes.click();
    else await page.locator('[data-on="ans"], [data-on="gridDone"], [data-on="duel"][data-arg="a"], [data-on="pick"]').first().click();
  }
  await expect(page.locator(".mood")).toBeVisible();
}

test("a failed save (storage refuses the write) shows a toast and keeps the screen", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?store=local");
  await openMore(page, "brain");
  await page.locator('[data-on="rate"]').first().waitFor();
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (String(k).startsWith("mabalach_v1")) throw new DOMException("quota", "QuotaExceededError");
      return set.call(this, k, v);
    };
  });
  await page.locator('[data-on="rate"]').first().click();
  await expect(page.locator(".toast")).toContainText("השמירה לא הצליחה");
  await noBlank(page);
  await expect(page.locator('[data-on="rate"]').first()).toBeVisible(); // the list is still there
  expect(errors).toEqual([]);
});

test("her quiz plays to a result even when every save fails", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (String(k).startsWith("mabalach_v1")) throw new DOMException("quota", "QuotaExceededError");
      return set.call(this, k, v);
    };
  });
  await page.goto(`/?store=local#q=${GUEST}`);
  await page.getByRole("button", { name: "יאללה, תנחש" }).click();
  await playToResult(page);
  await noBlank(page);
  expect(errors).toEqual([]);
});

for (const [name, handler] of [
  ["the request is refused", (r) => r.abort("failed")],
  ["the server answers 500", (r) => r.fulfill({ status: 500, body: "boom" })],
  ["the answer is not JSON", (r) => r.fulfill({ status: 200, body: "<html>captive portal</html>" })],
  ["the answer has no weather in it", (r) => r.fulfill({ json: { nothing: true } })],
]) {
  test(`weather fetch fails (${name}): the quiz and the home screen still work`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route(/open-meteo\.com/, handler);
    await page.addInitScript(() => {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("mabalach_room", "e2eweather000000000000000");
      localStorage.setItem("mabalach_v1:e2eweather000000000000000", JSON.stringify({ room: { settings: { city: "רעננה" } }, cols: {} }));
    });
    await page.goto("/?store=local");
    await expect(page.locator("h1")).toHaveText("מה בא לך?");
    await noBlank(page);
    await page.goto(`/?store=local#q=${GUEST}`);
    await page.getByRole("button", { name: "יאללה, תנחש" }).click();
    await playToResult(page);
    expect(errors).toEqual([]);
  });
}

test("no network at all: the installed app opens from its cache and works", async ({ page, context }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?store=local&sw");
  await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 15000 });
  // the first claim by the worker may reload the page (controllerchange): ask again until the whole shell is cached
  await expect
    .poll(() => page.evaluate(async () => { const k = (await caches.keys()).find((x) => x.startsWith("wte-")); return k ? (await (await caches.open(k)).keys()).length : 0; }).catch(() => 0), { timeout: 20000 })
    .toBeGreaterThan(40);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("h1")).toHaveText("מה בא לך?");
  await noBlank(page);
  await openMore(page, "settings"); // a screen that is loaded on demand, from the cache
  await noBlank(page);
  await context.setOffline(false);
  expect(errors).toEqual([]);
});

test("Firebase cannot be reached at start: a friendly offline message with a retry button", async ({ page }) => {
  await page.route(/gstatic\.com|googleapis\.com|firebaseio\.com|identitytoolkit/, (r) => r.abort("internetdisconnected"));
  await page.goto("/");
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("אין אינטרנט", { timeout: 25000 });
  await expect(page.locator('[data-on="retry"]')).toBeVisible();
  await expect(page.locator("#app")).not.toBeEmpty();
});
