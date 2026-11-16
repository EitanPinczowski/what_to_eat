// Item 33e: axe accessibility scan of the main screens, light and dark. Fails on serious and critical issues only (A11Y_ALL=1 lists every impact level).
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { oldLocalRecord } from "../tests/fixtures/old-data.js";
import { openMore } from "./helpers.js";

const ROOM = "e2ea11y00000000000000000";
const GUEST = "e2eguest0000000000000000";

async function scan(page, name) {
  await page.waitForTimeout(250); // let a screen change settle (focus move, redraw)
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
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(`/?store=local#q=${GUEST}`);
    await page.getByRole("button", { name: "יאללה, תנחש" }).waitFor();
    await scan(page, `guest welcome ${scheme}`);
    await page.getByRole("button", { name: "יאללה, תנחש" }).click();
    await page.locator(".q").waitFor();
    await scan(page, `guest question ${scheme}`);
    await page.locator('[data-on="escape"]').click();
    await page.locator('input[name="food"]').waitFor();
    await scan(page, `guest free text ${scheme}`);
    await page.locator('[data-on="back"], [data-on="undo"]').first().click().catch(() => {});
  });
}

test("her quiz result screen", async ({ page }) => {
  await page.goto(`/?store=local#q=${GUEST}`);
  await page.getByRole("button", { name: "יאללה, תנחש" }).click();
  for (let i = 0; i < 40 && !(await page.locator(".mood").count()); i++) {
    const yes = page.locator('[data-on="guess"][data-arg="yes"]');
    if (await yes.count()) await yes.click();
    else await page.locator('[data-on="ans"], [data-on="gridDone"], [data-on="duel"][data-arg="a"], [data-on="pick"]').first().click();
  }
  await expect(page.locator(".mood")).toBeVisible();
  await scan(page, "guest result");
});
