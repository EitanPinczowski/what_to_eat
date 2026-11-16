import { test, expect } from "@playwright/test";

const ROOM_KEY = "mabalach_room";
const readRoom = (page) =>
  page.evaluate(([k]) => JSON.parse(localStorage.getItem(`mabalach_v1:${localStorage.getItem(k)}`)), [ROOM_KEY]);
const seedPlaces = async (page) => {
  await page.waitForFunction((k) => localStorage.getItem(`mabalach_v1:${localStorage.getItem(k)}`), ROOM_KEY);
  await page.evaluate(([k]) => {
    const key = `mabalach_v1:${localStorage.getItem(k)}`;
    const d = JSON.parse(localStorage.getItem(key));
    for (const [id, name] of [["pa", "פיצה של רפי"], ["pb", "סושי בר"], ["pc", "בורגר סלון"]])
      d.cols.places[id] = { id, name, city: "", modes: ["sit", "take", "delivery"], foods: [], price: 2, rating: 4, link: "", note: "", shabbat: false, hours: [], visits: [] };
    localStorage.setItem(key, JSON.stringify(d));
  }, [ROOM_KEY]);
};

// Never touch the real network: anything that is not our own server is stubbed or refused.
test.beforeEach(async ({ context }) => {
  await context.route(/^https?:\/\/(?!localhost)/, (r) => {
    const u = r.request().url();
    if (/open-meteo/.test(u)) return r.fulfill({ json: u.includes("geocoding") ? { results: [] } : { current: { temperature_2m: 20, precipitation: 0 } } });
    return r.fulfill({ status: 200, body: "{}" });
  });
});

async function placesForm(page, link) {
  await page.locator('[data-on="go"][data-arg="places"]').click();
  await page.getByTestId("try-add").click();
  await page.getByTestId("try-link").fill(link);
}

test("want to try: a Google Maps link fills the name and saves a 'to try' place", async ({ page }) => {
  await page.goto("/?store=local");
  await placesForm(page, "https://www.google.com/maps/place/Burger+Salon/@32.1,34.8,17z");
  await expect(page.getByTestId("try-name")).toHaveValue(/Burger/);
  await page.getByTestId("try-save").click();
  await expect(page.locator(".place-row")).toContainText("Burger");
  await expect(page.locator(".place-row")).toContainText("עוד לא ביקרנו");
  const d = await readRoom(page);
  const p = Object.values(d.cols.places)[0];
  expect(p).toMatchObject({ wantTry: true });
  expect(p.link).toMatch(/^https:\/\/www\.google\.com\/maps\//);
});

test("want to try: an Instagram handle becomes the name; a post link asks for one", async ({ page }) => {
  await page.goto("/?store=local");
  await placesForm(page, "https://www.instagram.com/pizza.rafi/");
  await expect(page.getByTestId("try-name")).toHaveValue("pizza.rafi");
  await page.getByTestId("try-save").click();
  await expect(page.locator(".place-row")).toContainText("pizza.rafi");

  await page.getByTestId("try-add").click();
  await page.getByTestId("try-link").fill("https://www.instagram.com/p/ABC123/");
  await expect(page.getByTestId("try-name")).toHaveValue("");
  await page.getByTestId("try-save").click();
  await expect(page.locator(".toast").last()).toBeVisible();
  await expect(page.getByTestId("try-name")).toBeVisible(); // still on the form, nothing saved
  await page.getByTestId("try-name").fill("המקום מהפוסט");
  await page.getByTestId("try-save").click();
  await expect(page.locator(".place-row")).toHaveCount(2);
});

test("want to try: a link that is not Maps or Instagram is refused", async ({ page }) => {
  await page.goto("/?store=local");
  await placesForm(page, "https://example.com/x");
  await page.getByTestId("try-name").fill("משהו");
  await page.getByTestId("try-save").click();
  await expect(page.getByTestId("try-save")).toBeVisible();
  expect(Object.keys((await readRoom(page)).cols.places ?? {})).toHaveLength(0);
});

test("place vote: owner sends 2, she picks one, owner sees it and gets navigation; live reply reaches her", async ({ page, context }) => {
  await page.goto("/?store=local");
  await seedPlaces(page);
  await page.reload();
  await page.locator('[data-on="go"][data-arg="send"]').click();
  const link = await page.locator("code.link").textContent();
  await page.locator('[data-on="back"]').click();

  const her = await context.newPage();
  await her.goto(link.replace("#", "?store=local#"));
  await her.getByRole("button", { name: "יאללה, תנחש" }).click();
  await her.locator('[data-on="escape"]').click();
  await her.locator('input[name="food"]').fill("פיצה");
  await her.getByRole("button", { name: "זה!" }).click();
  await her.locator('[data-on="send"]').click();
  await expect(her.getByRole("status").first()).toContainText("קיבל");

  // live reply: owner taps, her sent screen updates in place
  await expect(page.getByTestId("ackbar")).toBeVisible();
  await page.getByTestId("ackbar").locator('[data-on="ack"][data-arg="onway"]').click();
  await expect(her.getByTestId("ack")).not.toHaveText("");
  const line = await her.getByTestId("ack").textContent();
  await page.getByTestId("ackbar").locator('[data-on="ack"][data-arg="onway"]').click(); // tap again clears
  await page.getByTestId("ackbar").locator('[data-on="ack"][data-arg="there"]').click();
  await expect(her.getByTestId("ack")).not.toHaveText(line);

  await page.locator('[data-on="go"][data-arg="picker"]').click();
  await page.locator('select[data-input="food"]').selectOption(""); // her fresh result preselects pizza (item 9); the vote lists every place
  await expect(page.getByTestId("vote-send")).toHaveCount(0);
  await page.locator('[data-on="voteToggle"]').nth(0).click();
  await expect(page.getByTestId("vote-send")).toHaveCount(0); // need at least two
  await page.locator('[data-on="voteToggle"]').nth(1).click();
  await page.getByTestId("vote-send").click();
  await expect(page.getByTestId("vote-status")).toBeVisible();

  const opts = her.getByTestId("vote").locator('[data-on="vote"]');
  await expect(opts).toHaveCount(3); // two places + "neither"
  const picked = (await opts.first().textContent()).trim();
  await opts.first().click();
  await expect(page.getByTestId("vote-status")).toContainText(picked);
  await page.getByTestId("vote-go").click();
  await expect(page.getByTestId("nav")).toContainText(picked);
  await expect(page.getByTestId("nav-waze")).toHaveAttribute("href", /waze\.com/);
  await expect(page.getByTestId("nav-maps")).toHaveAttribute("href", /google\.com\/maps|maps\.google|goo\.gl/);
});

test("monthly recap link opens, shows cards and swipes with the buttons", async ({ page }) => {
  const s = { v: 1, mo: "2026-10", n: 5, enough: true, top: [["pizza", "פיצה", "🍕", 2], ["sushi", "סושי", "🍣", 2]], hit: 60, q: null, pl: "פיצה של רפי", her: "נוגה", me: "איתן" };
  await page.goto("/?store=local#w=" + Buffer.from(JSON.stringify(s)).toString("base64url"));
  const card = page.locator(".wr-card");
  await expect(card).toHaveAttribute("data-k", "intro");
  await expect(card).toContainText("נוגה");
  await page.locator('[data-on="next"]').click();
  await expect(card).toHaveAttribute("data-k", "top");
  await expect(card).toContainText("פיצה");
  await page.locator('[data-on="next"]').click();
  await expect(card).toHaveAttribute("data-k", "hit");
  await page.locator('[data-on="prev"]').click();
  await expect(card).toHaveAttribute("data-k", "top");
  for (let i = 0; i < 4; i++) if (await page.locator('[data-on="next"]:not([disabled])').count()) await page.locator('[data-on="next"]').click();
  await expect(card).toHaveAttribute("data-k", "share");
  await expect(page.getByTestId("wr-share")).toBeVisible();
});

test("back gesture: owner sub-screens go one step back and never leave the app", async ({ page }) => {
  await page.goto("/?store=local");
  await page.locator('.tile[data-arg="places"]').click();
  await page.locator('[data-on="add"]').click();
  await expect(page.locator('[data-input="name"]')).toBeVisible();
  await page.goBack();
  await expect(page.locator('[data-on="add"]')).toBeVisible(); // places list
  await page.goBack();
  await expect(page.locator(".tiles")).toBeVisible(); // home
  expect(page.url()).toContain("localhost:8000");
  await page.locator('.tile[data-arg="settings"]').click();
  await page.goBack();
  await expect(page.locator(".tiles")).toBeVisible();
});

test("back gesture: mid-quiz goes one question back and stays in the app", async ({ page }) => {
  await page.goto("/?store=local#q=backgest0000000000000000");
  await page.getByRole("button", { name: "יאללה, תנחש" }).click();
  const q1 = await page.locator(".q").textContent();
  await page.locator('[data-on="ans"]').first().click();
  await expect(page.locator(".q")).not.toHaveText(q1);
  await page.goBack();
  await expect(page.locator(".q")).toHaveText(q1);
  expect(page.url()).toContain("localhost:8000");
  await page.locator('[data-on="escape"]').click();
  await expect(page.locator('input[name="food"]')).toBeVisible();
  await page.goBack();
  await expect(page.locator(".q")).toHaveText(q1);
});

test("settings: a pasted site address is normalised, saved and survives a reload", async ({ page }) => {
  await page.goto("/?store=local");
  await page.locator('.tile[data-arg="settings"]').click();
  await page.locator('input[name="base"]').fill("Https://EitanPinczowski.github.io/what_to_eat/ ");
  await page.getByRole("button", { name: "שמירה" }).click();
  await expect(page.locator('input[name="base"]')).toHaveValue("https://eitanpinczowski.github.io/what_to_eat/");
  await page.reload();
  await page.locator('.tile[data-arg="settings"]').click();
  await expect(page.locator('input[name="base"]')).toHaveValue("https://eitanpinczowski.github.io/what_to_eat/");
  await page.locator('[data-on="back"]').click();
  await page.locator('.tile[data-arg="send"]').click();
  await expect(page.locator("code.link")).toContainText("https://eitanpinczowski.github.io/what_to_eat/#q=");
  await page.locator('[data-on="back"]').click();
  await page.locator('.tile[data-arg="settings"]').click();
  await page.locator('input[name="base"]').fill("not an address");
  await page.getByRole("button", { name: "שמירה" }).click();
  await expect(page.locator('input[name="base"]')).toHaveValue("not an address"); // refused, not saved
});

const supported = (perm) => {
  if (!window.PushManager) window.PushManager = function () {};
  if (!window.Notification) window.Notification = function () {};
  if (!navigator.serviceWorker) Object.defineProperty(navigator, "serviceWorker", { value: { getRegistration: async () => null }, configurable: true });
  Object.defineProperty(window.Notification, "permission", { get: () => perm, configurable: true });
};
for (const [state, setup, text, perm] of [
  ["unsupported", () => { delete window.PushManager; }, "לא תומך"],
  ["blocked", supported, "חסומות", "denied"],
  ["off", supported, "כבויות", "default"],
]) {
  test(`settings: notifications card says "${state}" with no network call`, async ({ page }) => {
    const calls = [];
    page.on("request", (r) => /ntfy|wte-push|fcm|push/.test(r.url()) && !r.url().includes("localhost") && calls.push(r.url()));
    await page.addInitScript(setup, perm);
    await page.goto("/?store=local");
    await page.locator('.tile[data-arg="settings"]').click();
    await expect(page.getByTestId("push-state")).toContainText(text);
    if (state === "off") await expect(page.locator('[data-on="pushOn"]')).toBeVisible();
    else await expect(page.locator('[data-on="pushOn"]')).toHaveCount(0);
    expect(calls).toEqual([]);
  });
}

test("back gesture: opening and leaving the 'she's next to me' quiz repeatedly keeps one step per back", async ({ page }) => {
  await page.goto("/?store=local");
  for (let k = 0; k < 3; k++) {
    await page.locator('.tile[data-arg="local"]').click();
    const q1 = await page.locator(".q").first().textContent();
    await page.locator('[data-on="ans"]').first().click();
    await expect(page.locator(".q").first()).not.toHaveText(q1);
    await page.goBack(); // one answer back
    await expect(page.locator(".q").first()).toHaveText(q1);
    await page.goBack(); // out of the quiz, home
    await expect(page.locator(".tiles")).toBeVisible();
    expect(page.url()).toContain("localhost:8000");
  }
});

test("settings: the 'she opened the quiz' alert is off by default and the choice sticks", async ({ page }) => {
  await page.goto("/?store=local");
  await page.locator('.tile[data-arg="settings"]').click();
  const box = page.getByTestId("notify-open");
  await expect(box).not.toBeChecked();
  await box.check();
  await page.locator('[data-on="back"]').click();
  await page.locator('.tile[data-arg="settings"]').click();
  await expect(page.getByTestId("notify-open")).toBeChecked();
});
