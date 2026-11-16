import { test, expect } from "@playwright/test";

// Next-day check-in opt-in, relay stubbed: nothing is subscribed or scheduled until she taps yes.
async function toSent(page, room) {
  await page.addInitScript(() => {
    const sub = { endpoint: "https://fcm.googleapis.com/fcm/send/e2e", keys: { p256dh: "p", auth: "a" } };
    window.__subscribed = 0;
    if (!window.PushManager) window.PushManager = function () {};
    Object.defineProperty(window.Notification, "permission", { get: () => "default", configurable: true });
    window.Notification.requestPermission = async () => "granted";
    const reg = { pushManager: { getSubscription: async () => null, subscribe: async () => (window.__subscribed++, { toJSON: () => sub }) } };
    Object.defineProperty(navigator.serviceWorker, "getRegistration", { value: async () => reg, configurable: true });
  });
  await page.goto(`/?store=local#q=${room}`);
  await page.getByRole("button", { name: "יאללה, תנחש" }).click();
  await page.locator('[data-on="escape"]').click();
  await page.locator('input[name="food"]').fill("פיצה");
  await page.getByRole("button", { name: "זה!" }).click();
  await page.locator('[data-on="send"]').click();
  await expect(page.getByTestId("checkin-yes")).toBeVisible();
}

test("check-in: yes subscribes and schedules through the relay", async ({ page }) => {
  const posts = [];
  await page.route(/wte-push\.vercel\.app/, (r) => (r.request().method() === "POST" && r.request().url().endsWith("/schedule") && posts.push({ body: r.request().postDataJSON(), sig: r.request().headers()["x-wte-sig"] }), r.fulfill({ status: 201, json: { ok: true } })));
  await page.route(/ntfy\.sh|gstatic|googleapis|firebase|fonts\./, (r) => r.fulfill({ status: 200, body: "{}" }));
  await toSent(page, "e2echeckin00000000000000");
  expect(await page.evaluate(() => window.__subscribed)).toBe(0);
  await page.getByTestId("checkin-yes").click();
  await expect(page.getByTestId("checkin-result")).toContainText("אזכיר");
  expect(posts).toHaveLength(1);
  expect(posts[0].body).toMatchObject({ food: "pizza" });
  expect(posts[0].body.at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(posts[0].sig).toMatch(/^[0-9a-f]{64}$/);
});

test("check-in: no schedules nothing", async ({ page }) => {
  let calls = 0;
  await page.route(/wte-push\.vercel\.app/, (r) => (calls++, r.fulfill({ status: 201, json: {} })));
  await page.route(/ntfy\.sh|gstatic|googleapis|firebase|fonts\./, (r) => r.fulfill({ status: 200, body: "{}" }));
  await toSent(page, "e2echeckin00000000000001");
  await page.getByTestId("checkin-no").click();
  await expect(page.getByTestId("checkin-yes")).toHaveCount(0);
  expect(await page.evaluate(() => window.__subscribed)).toBe(0);
  expect(calls).toBe(0);
});
