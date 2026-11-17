// Item 33e: axe accessibility scan of the main screens, light and dark. Fails on serious and critical issues only (A11Y_ALL=1 lists every impact level).
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { oldLocalRecord } from "../tests/fixtures/old-data.js";
import { openMore, magnets, pickCategory } from "./helpers.js";

const ROOM = "e2ea11y00000000000000000";
const GUEST = "e2eguest0000000000000000";

async function scan(page, name) {
  await page.waitForTimeout(250); // let a screen change settle (focus move, redraw)
  // a screen fading in has half-blended colors; wait until no animation or transition is running (WebKit flaked on this)
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"), null, { timeout: 5000 }).catch(() => {});
  // Contrast is measured against what is behind the text: wait until every photo has loaded (or failed to) so the result does not depend on timing.
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 15000 }).catch(() => {});
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const bad = r.violations.filter((v) => process.env.A11Y_ALL || v.impact === "serious" || v.impact === "critical");
  expect(
    bad.map((v) => `${name}: ${v.id} (${v.impact}) ${v.help} -> ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`),
  ).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!localhost)/, (r) => r.fulfill({ status: 200, body: "{}" }));
});

for (const scheme of ["light", "dark"]) {
  test(`owner screens (${scheme})`, async ({ page }) => {
    test.setTimeout(120000); // ten screens, each loaded and scanned; WebKit is slower
    await page.emulateMedia({ colorScheme: scheme });
    await page.addInitScript(
      ([room, record]) => {
        if (sessionStorage.getItem("seeded")) return;
        sessionStorage.setItem("seeded", "1");
        localStorage.setItem("mabalach_room", room);
        localStorage.setItem(`mabalach_v1:${room}`, JSON.stringify(record));
      },
      [ROOM, oldLocalRecord()],
    );
    for (const key of [null, "more", "send", "history", "places", "picker", "brain", "shopping", "insights", "settings"]) {
      await page.goto("/?store=local");
      await page.locator(".tile").first().waitFor();
      if (key === "more") await page.locator('[data-on="go"][data-arg="more"]').click();
      else if (key) {
        const direct = page.locator(`.tile[data-on="go"][data-arg="${key}"]`);
        if (await direct.count()) await direct.first().click();
        else await openMore(page, key);
        await page.locator('[data-on="back"]').first().waitFor();
      }
      await scan(page, `owner ${key ?? "home"} ${scheme}`);
    }
  });

  test(`her quiz screens (${scheme})`, async ({ page }) => {
    test.setTimeout(90000);
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(`/?store=local#q=${GUEST}`);
    await page.getByRole("button", { name: "יאללה, תנחש" }).waitFor();
    await scan(page, `guest welcome ${scheme}`);
    await page.getByRole("button", { name: "יאללה, תנחש" }).click();
    await pickCategory(page);
    await page.locator(".q").waitFor();
    await scan(page, `guest question ${scheme}`);
    await page.locator('[data-on="escape"]').click();
    await page.locator('input[name="food"]').waitFor();
    await scan(page, `guest free text ${scheme}`);
    await page.locator('[data-on="back"], [data-on="undo"]').first().click().catch(() => {});
  });
}

test("her quiz screens at night", async ({ page }) => {
  test.setTimeout(60000);
  await page.clock.install({ time: new Date("2026-11-16T21:30:00") });
  await page.goto(`/?store=local#q=${GUEST}`);
  await page.getByRole("button", { name: "יאללה, תנחש" }).waitFor();
  await expect(page.locator("html.night")).toHaveCount(1);
  await scan(page, "guest welcome night");
  await page.getByRole("button", { name: "יאללה, תנחש" }).click();
  await pickCategory(page);
  await page.locator(".q").waitFor();
  await scan(page, "guest question night");
});

test("her quiz result screen", async ({ page }) => {
  await page.goto(`/?store=local#q=${GUEST}`);
  await page.getByRole("button", { name: "יאללה, תנחש" }).click();
  await pickCategory(page);
  for (let i = 0; i < 40 && !(await page.locator(".mood").count()); i++) {
    const yes = page.locator('[data-on="guess"][data-arg="yes"]');
    if (await yes.count()) await yes.click();
    else {
      await magnets(page);
      await page.locator('[data-on="cat"], [data-on="ans"], [data-on="gridDone"], [data-on="duel"][data-arg="a"], [data-on="gut"][data-arg="a"], [data-on="pick"]').first().click(); }
  }
  await expect(page.locator(".mood")).toBeVisible();
  await scan(page, "guest result");
});
