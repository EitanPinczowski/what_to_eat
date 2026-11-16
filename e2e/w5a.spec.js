import { test, expect } from "@playwright/test";

test("slider answer: a real range input snaps to stops and the confirm button carries the bucket", async ({ page }) => {
  await page.goto("/?store=local");
  await page.evaluate(async () => {
    const [{ QUESTIONS }, m, { setQPics }] = await Promise.all([import("/js/data/questions.js"), import("/js/ui/guest/answers/slider.js"), import("/js/ui/pics.js")]);
    setQPics([]);
    const host = document.createElement("div");
    host.id = "slider-host";
    document.body.append(host);
    m.mount(host, QUESTIONS.find((q) => q.id === "hunger4"));
  });
  const range = page.locator("#slider-host input[type=range]");
  await expect(range).toHaveAttribute("max", "4");
  await range.fill("4");
  await expect(page.locator("#slider-host [data-on=ans]")).toHaveAttribute("data-arg", "4");
  await expect(page.locator("#slider-host .stop.on")).toHaveAttribute("data-i", "4");
  await expect(page.locator("#slider-host .now")).toHaveText("אוכלת את השולחן");
});

test("Eitan's note on the send screen shows as a small card on her welcome screen", async ({ page, context }) => {
  await page.goto("/?store=local");
  await page.locator('[data-on="go"][data-arg="send"]').click();
  const link = await page.locator("code.link").textContent();
  await page.getByTestId("note").fill("מחכה לך בבית");
  await page.locator('[data-on="copy"]').click();
  const her = await context.newPage();
  await her.goto(link.replace("#", "?store=local#"));
  await expect(her.getByTestId("note-card")).toContainText("מחכה לך בבית");
});
