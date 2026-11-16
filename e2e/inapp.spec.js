// Item 33c: the quiz link opened inside WhatsApp / Instagram / Facebook in-app browsers.
// The app has no UA sniffing for these; what matters is that the link opens and the quiz plays with the things those
// webviews often lack (navigator.share, clipboard, window.open, sometimes storage). Works the same on Pixel and iPhone projects.
import { test, expect } from "@playwright/test";

const ROOM = "e2einapp0000000000000000";
const UAS = {
  "WhatsApp on Android (WebView)": "Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A.230901.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.230 Mobile Safari/537.36",
  "Instagram on iPhone": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21B74 Instagram 312.0.0.22.114 (iPhone14,5; iOS 17_1; he_IL; he; scale=3.00; 1170x2532; 536040161)",
  "Instagram on Android": "Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A.230901.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.230 Mobile Safari/537.36 Instagram 312.0.0.34.111 Android (33/13; 420dpi; 1080x2400; Google/google; Pixel 7; panther; panther; he_IL; 548000000)",
  "Facebook on iPhone": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21B74 [FBAN/FBIOS;FBAV/440.0.0.30.113;FBBV/500000000;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/17.1;FBSS/3;FBID/phone;FBLC/he_IL;FBOP/5]",
};

async function playToResult(page) {
  for (let i = 0; i < 40; i++) {
    if (await page.locator(".mood").count()) return;
    const yes = page.locator('[data-on="guess"][data-arg="yes"]');
    if (await yes.count()) {
      await yes.click();
      continue;
    }
    await page.locator('[data-on="ans"], [data-on="gridDone"], [data-on="duel"][data-arg="a"], [data-on="gut"][data-arg="a"], [data-on="pick"]').first().click();
  }
}

for (const [name, userAgent] of Object.entries(UAS)) {
  test.describe(name, () => {
    test.use({ userAgent });

    test("quiz link opens and plays to a result without share, clipboard or window.open", async ({ page }) => {
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.addInitScript(() => {
        for (const k of ["share", "canShare", "clipboard"]) Object.defineProperty(navigator, k, { value: undefined, configurable: true });
        window.open = () => null;
      });
      await page.goto(`/?store=local#q=${ROOM}`);
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await expect(page.locator("#app h2")).toContainText("היי");
      await page.getByRole("button", { name: "יאללה, תנחש" }).click();
      await expect(page.getByTestId("qn")).toBeVisible();
      await playToResult(page);
      await expect(page.locator(".mood")).toBeVisible();
      await expect(page.locator(".title")).not.toBeEmpty();
      expect(errors).toEqual([]);
    });
  });
}

test.describe("in-app browser without usable storage", () => {
  test.use({ userAgent: UAS["Instagram on Android"] });

  test("the link still opens when localStorage throws", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      const boom = () => {
        throw new DOMException("denied", "SecurityError");
      };
      Object.defineProperty(window, "localStorage", { get: boom, configurable: true });
    });
    await page.goto(`/?store=local#q=${ROOM}`);
    // Either her quiz opens, or a friendly message shows; never a blank page.
    await expect(page.locator("#app")).not.toBeEmpty();
    await expect(page.locator("#app")).toContainText(/\S/);
    const opened = await page.getByRole("button", { name: "יאללה, תנחש" }).count();
    if (opened) await page.getByRole("button", { name: "יאללה, תנחש" }).click();
    await expect(page.locator("#app")).not.toBeEmpty();
    expect(errors).toEqual([]);
  });
});

test("the phone's back gesture inside the quiz steps back instead of leaving the page", async ({ page }) => {
  await page.goto(`/?store=local#q=${ROOM}`);
  await page.getByRole("button", { name: "יאללה, תנחש" }).click();
  const q1 = await page.locator(".q").textContent();
  await page.locator('[data-on="ans"]').first().click();
  await expect(page.locator(".q")).not.toHaveText(q1);
  await page.goBack();
  await expect(page.locator(".q")).toHaveText(q1);
  expect(page.url()).toContain("#q=");
});
