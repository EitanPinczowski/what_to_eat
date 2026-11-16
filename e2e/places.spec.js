import { test, expect } from "@playwright/test";

test("places: add a place, then pick it for a result and log the visit", async ({ page }) => {
  const p = { v: 1, t: "quiz", id: "pick1", f: "pizza", fn: "פיצה", fe: "🍕", m: "delivery", price: 2, trail: [] };
  page.on("dialog", (d) => d.accept()); // #r= imports ask first
  await page.goto(`/?store=local#r=${Buffer.from(JSON.stringify(p)).toString("base64url")}`);
  await page.locator('[data-on="go"][data-arg="places"]').click();
  await page.locator('[data-on="add"]').click();
  await page.locator('[data-input="name"]').fill("פיצה של רפי");
  await page.locator('[data-input="city"]').fill("רעננה");
  await page.locator('[data-on="mode"][data-arg="delivery"]').click();
  await page.locator('[data-input="foodq"]').fill("פיצ");
  await page.locator('[data-on="serve"][data-arg="pizza"]').click();
  await expect(page.locator(".served")).toContainText("פיצה");
  // serving a dish switches its cuisines on; she can still correct them
  await expect(page.locator('[data-on="cuisine"][data-arg="italian"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator('[data-on="cuisine"][data-arg="american"]').click();
  await page.locator('[data-on="rating"][data-arg="5"]').click();
  await page.locator('[data-input="shabbat"]').check();
  await page.locator('[data-input="shabbat"]').uncheck(); // Shabbat filtering is unit-tested; keep this day-independent
  await page.getByRole("button", { name: "שמירה" }).click();
  await expect(page.locator(".place-row")).toContainText("פיצה של רפי");
  await page.locator('[data-testid="cuisine-filter"] [data-arg="cafe"]').click();
  await expect(page.locator(".place-row")).toHaveCount(0);
  await page.locator('[data-testid="cuisine-filter"] [data-arg="italian"]').click();
  await expect(page.locator(".place-row")).toContainText("פיצה של רפי");

  await page.locator('[data-on="back"]').click();
  await page.locator('[data-on="go"][data-arg="history"]').click();
  await page.locator('[data-on="pickFor"]').click();
  await expect(page.locator(".food-row")).toContainText("מגישים פיצה");
  await page.locator('[data-on="roll"]').click();
  await expect(page.getByTestId("chosen")).toContainText("פיצה של רפי");
  await page.getByTestId("chosen").locator('[data-on="go"]').click();
  // "Going" now shows the directions card (Waze / Google Maps) before returning home.
  await expect(page.getByTestId("nav")).toContainText("פיצה של רפי");
  await expect(page.getByTestId("nav-waze")).toHaveAttribute("href", /waze\.com/);
  await page.getByTestId("nav").locator('[data-on="navDone"]').click();
  await expect(page.locator(".tiles")).toBeVisible();
  const room = await page.evaluate(() => localStorage.getItem("mabalach_room"));
  const readRoom = () => page.evaluate((r) => JSON.parse(localStorage.getItem(`mabalach_v1:${r}`)), room);
  await expect.poll(async () => Object.values((await readRoom()).cols.places)[0]?.visits?.length).toBe(1);
  const d = await readRoom();
  const place = Object.values(d.cols.places)[0];
  expect(place).toMatchObject({ name: "פיצה של רפי", city: "רעננה", modes: ["delivery"], foods: ["pizza"], cuisines: ["italian", "american"], rating: 5, shabbat: false });
  expect(place.visits.length).toBe(1);
  expect(d.cols.history.pick1.goAt).toBeTruthy();
});

test("picker: maps fallback asks where we went and quick-adds the place", async ({ page, context }) => {
  await page.goto("/?store=local");
  await page.locator('[data-on="go"][data-arg="picker"]').click();
  await page.locator('select[data-input="food"]').selectOption("sushi");
  await expect(page.locator(".fallbacks a")).toContainText("סושי");
  const popup = context.waitForEvent("page");
  await page.locator(".fallbacks a").first().click();
  await (await popup).close();
  await page.getByTestId("quick-add").locator("input").fill("סושי בר");
  await page.getByTestId("quick-add").locator('button[type="submit"]').click();
  await page.locator('[data-on="go"][data-arg="places"]').click();
  await expect(page.locator(".place-row")).toContainText("סושי בר");
});
