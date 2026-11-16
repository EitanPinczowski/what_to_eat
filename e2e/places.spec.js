import { test, expect } from "@playwright/test";
import { openMore } from "./helpers.js";

test("places: add a place, then pick it for a result and log the visit", async ({ page }) => {
  const p = { v: 1, t: "quiz", id: "pick1", f: "pizza", fn: "פיצה", fe: "🍕", m: "delivery", price: 2, trail: [] };
  page.on("dialog", (d) => d.accept()); // #r= imports ask first
  await page.goto(`/?store=local#r=${Buffer.from(JSON.stringify(p)).toString("base64url")}`);
  await openMore(page, "places");
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
  await page.locator("details[data-k=more] summary").click(); // less-used fields sit behind "עוד פרטים"
  await page.locator('[data-input="shabbat"]').check();
  await page.locator('[data-input="shabbat"]').uncheck(); // Shabbat filtering is unit-tested; keep this day-independent
  await page.getByRole("button", { name: "שמירה" }).click();
  await expect(page.locator(".place-row")).toContainText("פיצה של רפי");
  await page.locator('[data-testid="cuisine-filter"] [data-arg="cafe"]').click();
  await expect(page.locator(".place-row")).toHaveCount(0);
  await page.locator('[data-testid="cuisine-filter"] [data-arg="italian"]').click();
  await expect(page.locator(".place-row")).toContainText("פיצה של רפי");

  await page.locator('[data-on="back"]').click();
  await openMore(page, "history");
  await page.locator('[data-on="pickFor"]').click();
  await expect(page.locator("li.row")).toContainText("מגישים פיצה");
  await page.locator('[data-on="roll"]').click();
  await expect(page.getByTestId("chosen")).toContainText("פיצה של רפי");
  await page.getByTestId("chosen-go").click();
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
  await page.locator('[data-testid="picker-cuisine"] [data-arg="japanese"]').click();
  await expect(page.locator(".fallbacks a").first()).toContainText("יפנית"); // searches by the category, not a dish
  const popup = context.waitForEvent("page");
  await page.locator(".fallbacks a").first().click();
  await (await popup).close();
  await page.getByTestId("quick-add").locator("input").fill("סושי בר");
  await page.getByTestId("quick-add").locator('button[type="submit"]').click();
  await openMore(page, "places");
  await expect(page.locator(".place-row")).toContainText("סושי בר");
});

test("picker from home links to a fresh quiz result (item 9)", async ({ page, context }) => {
  await page.goto("/?store=local");
  await expect(page.locator(".tile")).toHaveCount(3);
  const room = await page.evaluate(() => localStorage.getItem("mabalach_room"));
  await page.evaluate((room) => {
    const key = `mabalach_v1:${room}`;
    const d = JSON.parse(localStorage.getItem(key));
    d.cols.history = { fresh1: { at: new Date(Date.now() - 20 * 60e3).toISOString(), f: "sushi", fn: "סושי", fe: "🍣", m: "sit", stats: { hit: true, steps: 9, skips: [] }, trail: [] } };
    localStorage.setItem(key, JSON.stringify(d));
  }, room);
  await page.reload();
  await page.locator('[data-on="go"][data-arg="picker"]').click();
  await expect(page.locator('[data-testid="picker-cuisine"] [data-arg="japanese"]')).toHaveAttribute("aria-pressed", "true");
  const popup = context.waitForEvent("page");
  await page.locator(".fallbacks a").first().click();
  await (await popup).close();
  await page.getByTestId("quick-add").locator("input").fill("סושי בר");
  await page.getByTestId("quick-add").locator('button[type="submit"]').click();
  await expect.poll(async () => (await page.evaluate((r) => JSON.parse(localStorage.getItem(`mabalach_v1:${r}`)), room)).cols.history.fresh1.place).toBeTruthy();
});

test("picker from a result: category preselected, only its places, booking button on the chosen place", async ({ page }) => {
  await page.goto("/?store=local");
  await expect(page.locator(".tile")).toHaveCount(3);
  const room = await page.evaluate(() => localStorage.getItem("mabalach_room"));
  await page.evaluate((room) => {
    const key = `mabalach_v1:${room}`;
    const d = JSON.parse(localStorage.getItem(key));
    d.cols.history = { fresh2: { at: new Date(Date.now() - 20 * 60e3).toISOString(), f: "pizza", fn: "פיצה", fe: "🍕", m: "sit", stats: { hit: true, steps: 9, skips: [] }, trail: [] } };
    const pl = (id, name, cuisines, link) => (d.cols.places[id] = { id, name, city: "רעננה", modes: ["sit"], foods: [], cuisines, price: 2, rating: 3, link, note: "", shabbat: false, hours: [], visits: [] });
    pl("p1", "טרטוריה", ["italian"], "https://ontopo.com/he/il/page/42");
    pl("p2", "סושי בר", ["asian"], "");
    localStorage.setItem(key, JSON.stringify(d));
  }, room);
  await page.reload();
  await page.locator('[data-on="go"][data-arg="picker"]').click();
  await expect(page.locator('[data-testid="picker-cuisine"] [data-arg="italian"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("wanted")).toContainText("פיצה");
  await expect(page.locator("li.row")).toHaveCount(1);
  await expect(page.locator("li.row")).toContainText("טרטוריה");
  await page.locator('[data-on="city"][data-arg="רעננה"]').click();
  await expect(page.getByTestId("ontopo-search")).toHaveAttribute("href", "https://ontopo.com/he/il/raanana");
  await page.locator('[data-on="choose"]').click();
  await expect(page.getByTestId("book")).toHaveAttribute("href", "https://ontopo.com/he/il/page/42");
  await expect(page.getByTestId("book")).toContainText("אונטופו");
  await expect(page.locator(".btn-primary")).toHaveCount(1);
});
