// UI tour: walks every screen at 360px in light and dark and saves screenshots OUTSIDE the repo.
// Opt-in: TOUR=1 npx playwright test e2e/tour.spec.js --project=pixel --retries=0   (TOUR_DIR overrides the folder)
import { test, devices } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const DIR = process.env.TOUR_DIR || join(tmpdir(), "wte-tour");
const B = "http://localhost:8000/";
const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const iso = (d) => new Date(Date.now() - d * 864e5).toISOString();
const prevMo = (() => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
})();

async function stubNet(ctx) {
  await ctx.route(/open-meteo\.com/, (r) =>
    r.request().url().includes("geocoding")
      ? r.fulfill({ json: { results: [{ latitude: 32.18, longitude: 34.87 }] } })
      : r.fulfill({ json: { current: { temperature_2m: 31, precipitation: 0 } } }),
  );
  await ctx.route(/ntfy\.sh|wte-push|gstatic|googleapis|firebase/, (r) => r.fulfill({ status: 200, body: "{}" }));
}

test.skip(!process.env.TOUR, "opt-in UI tour");

for (const scheme of ["light", "dark"]) {
  test(`tour ${scheme}`, async ({ browser }) => {
    test.setTimeout(240000);
    mkdirSync(DIR, { recursive: true });
    const ctx = await browser.newContext({ ...devices["Pixel 7"], viewport: { width: 360, height: 740 }, colorScheme: scheme, locale: "he-IL" });
    await stubNet(ctx);
    const page = await ctx.newPage();
    const problems = [];
    page.on("pageerror", (e) => problems.push(e.message));
    let n = 0;
    const shot = async (p, name) => {
      await p.waitForTimeout(250);
      await p.screenshot({ path: join(DIR, `${scheme}-${String(++n).padStart(2, "0")}-${name}.png`), fullPage: true });
    };
    const step = async (name, fn) => {
      try {
        await fn();
      } catch (e) {
        problems.push(`${name}: ${String(e.message).split("\n")[0]}`);
      }
    };
    const go = async (arg) => {
      const t = () => page.locator(`[data-on="go"][data-arg="${arg}"]`);
      if (!(await t().count()) && !(await page.locator('[data-arg="more"]').count())) await page.locator('[data-on="back"]').click(); // on the "more" list: back home first
      if (await t().count()) return t().first().click();
      await openMore(page, arg);
    };
    const back = () => page.locator('[data-on="back"]').click();

    await page.goto(B + "?store=local");
    await shot(page, "home-empty");
    const room = await page.evaluate(() => localStorage.getItem("mabalach_room"));
    await page.evaluate(
      ([room, prevMo, now]) => {
        const k = `mabalach_v1:${room}`;
        const d = JSON.parse(localStorage.getItem(k));
        const mk = (id, f, fn, fe, at, extra = {}) =>
          (d.cols.history[id] = { id, f, fn, fe, at, m: "take", price: 2, trail: ["שאלה 1", "שאלה 2"], stats: { hit: true, guesses: 1, steps: 6 }, ...extra });
        mk("h1", "falafel", "פלאפל", "🧆", now[0], { note: "היה מעולה" });
        mk("h2", "sushi", "סושי", "🍣", now[1], { m: "delivery", goAt: now[1] });
        mk("h3", "pizza", "פיצה", "🍕", prevMo + "-10T12:00:00Z");
        mk("h4", "pizza", "פיצה", "🍕", prevMo + "-12T12:00:00Z");
        mk("h5", "sushi", "סושי", "🍣", prevMo + "-14T12:00:00Z", { stats: { hit: false, guesses: 2, steps: 9 } });
        d.cols.places ||= {};
        const pl = (id, name, modes, foods, price, rating, extra = {}) =>
          (d.cols.places[id] = { id, name, city: "רעננה", modes, foods, price, rating, link: "", note: "", shabbat: false, hours: [], visits: [], ...extra });
        pl("p1", "פיצה של רפי", ["delivery", "take"], ["pizza"], 2, 4);
        pl("p2", "סושי בר", ["sit", "delivery"], ["sushi"], 3, 5);
        pl("p3", "בורגר סלון", ["sit", "take"], ["burger"], 2, 3, { wantTry: true });
        d.room.settings.city = "רעננה";
        localStorage.setItem(k, JSON.stringify(d));
      },
      [room, prevMo, [iso(1), iso(3)]],
    );
    await page.reload();
    await shot(page, "home-with-result");
    await step("send", async () => { await go("send"); await shot(page, "send-quiz"); await back(); });
    await step("history", async () => { await go("history"); await shot(page, "history-stats"); await back(); });
    await step("places", async () => {
      await go("places");
      await shot(page, "places-list");
      await page.locator('[data-on="add"]').click();
      await shot(page, "place-form");
      await back();
      await page.locator('[data-on="tryAdd"]').click();
      await shot(page, "try-form");
      await page.getByTestId("try-link").fill("https://maps.app.goo.gl/abc123");
      await shot(page, "try-form-filled");
      await back();
      await back();
    });
    await step("picker", async () => {
      await go("picker");
      await shot(page, "picker");
      await page.locator('[data-on="novel"]').click();
      await shot(page, "picker-novel");
      await page.locator('[data-on="novel"]').click();
      await page.locator('[data-on="voteToggle"]').nth(0).click();
      await page.locator('[data-on="voteToggle"]').nth(1).click();
      await shot(page, "picker-vote-selected");
      await page.getByTestId("vote-send").click();
      await shot(page, "picker-vote-sent");
      await page.locator('[data-on="roll"]').click();
      await page.getByTestId("chosen").waitFor({ timeout: 8000 });
      await shot(page, "picker-chosen");
      await page.getByTestId("chosen-go").click();
      await page.getByTestId("nav").waitFor();
      await shot(page, "navigation-card");
      await page.getByTestId("nav").locator('[data-on="navDone"]').click();
    });
    await step("cook", async () => {
      await page.evaluate(([room]) => {
        const k = `mabalach_v1:${room}`;
        const d = JSON.parse(localStorage.getItem(k));
        d.cols.history.hc = { id: "hc", f: "shakshuka", fn: "שקשוקה", fe: "🍳", at: new Date().toISOString(), m: "home", price: null, trail: [] };
        localStorage.setItem(k, JSON.stringify(d));
      }, [room]);
      await page.reload();
      await go("history");
      await page.locator('[data-on="pickFor"]').first().click();
      await shot(page, "cook-mode");
      await page.locator('[data-on="recipeOpen"]').first().click();
      await shot(page, "recipe");
      await page.getByTestId("add-shopping").click();
      await go("shopping");
      await shot(page, "shopping-list");
      await page.locator('input[data-input="tick"]').first().check();
      await shot(page, "shopping-ticked");
      await page.reload();
    });
    await step("brain", async () => { await go("brain"); await shot(page, "brain"); await back(); });
    await step("sweep-send", async () => { await go("sweep"); await shot(page, "sweep-send"); await back(); });
    await step("wrapped-send", async () => { await go("wrapped"); await shot(page, "recap-send"); await back(); });
    await step("settings", async () => {
      await go("settings");
      await shot(page, "settings-top");
      await page.getByTestId("push").scrollIntoViewIfNeeded();
      await shot(page, "settings-notifications");
      await back();
    });
    await step("ack", async () => {
      await page.evaluate(([room]) => {
        const k = `mabalach_v1:${room}`;
        const d = JSON.parse(localStorage.getItem(k));
        d.cols.live.quiz = { opened: true, finished: true, n: 5 };
        localStorage.setItem(k, JSON.stringify(d));
      }, [room]);
      await page.reload();
      await shot(page, "home-ackbar");
    });

    const her = await ctx.newPage();
    her.on("pageerror", (e) => problems.push("her: " + e.message));
    const wsum = { mo: prevMo, n: 5, enough: true, top: [["pizza", "פיצה", "🍕", 2], ["sushi", "סושי", "🍣", 2], ["falafel", "פלאפל", "🧆", 1]], hit: 60, q: "q1", pl: "פיצה של רפי", her: "נוגה", me: "איתן" };
    await step("her wrapped", async () => {
      await her.goto(B + "?store=local#w=" + enc({ v: 1, ...wsum }));
      await shot(her, "her-recap-first");
      const cards = her.locator(".wr-card");
      const c = await cards.count();
      for (let i = 1; i < c; i++) {
        await cards.nth(i).scrollIntoViewIfNeeded();
        await shot(her, `her-recap-${i}`);
      }
    });
    const roomQ = "tourroom00000000000000000";
    await step("her quiz", async () => {
      await her.goto(B + `?store=local#q=${roomQ}`);
      await her.locator("#app h2").first().waitFor();
      await her.evaluate(([r]) => {
        const k = `mabalach_v1:${r}`;
        const d = JSON.parse(localStorage.getItem(k) || "null");
        if (d?.room) { d.room.settings.city = "רעננה"; localStorage.setItem(k, JSON.stringify(d)); }
      }, [roomQ]);
      await her.reload();
      await shot(her, "her-intro");
      await her.getByRole("button", { name: "יאללה, תנחש" }).click();
      const seen = new Set();
      for (let i = 0; i < 40; i++) {
        if (await her.locator(".mood").count()) break;
        const kind = (await her.locator('[data-on="guess"]').count()) ? "guess" : (await her.locator('[data-on="gridDone"]').count()) ? "grid" : (await her.locator('[data-on="duel"]').count()) ? "duel" : (await her.locator('[data-on="pick"]').count()) ? "pick" : "ans";
        if (!seen.has(kind)) { seen.add(kind); await shot(her, `her-q-${kind}`); }
        if (kind === "guess") { await her.locator('[data-on="guess"][data-arg="yes"]').click(); continue; }
        await her.locator('[data-on="ans"], [data-on="gridDone"], [data-on="duel"][data-arg="a"], [data-on="gut"][data-arg="a"], [data-on="pick"]').first().click();
      }
      await shot(her, "her-finish");
      await her.locator('[data-on="mode"]').first().click();
      await her.locator('[data-on="send"]').click();
      await her.getByRole("status").first().waitFor();
      await shot(her, "her-sent");
    });
    await step("her vote+reply", async () => {
      await her.evaluate(([r]) => {
        const k = `mabalach_v1:${r}`;
        const d = JSON.parse(localStorage.getItem(k));
        d.cols.live.vote = { o: ["p1", "p2"], n: ["פיצה של רפי", "סושי בר"], at: new Date().toISOString() };
        d.cols.live.quiz.ack = "onway";
        localStorage.setItem(k, JSON.stringify(d));
        window.dispatchEvent(new StorageEvent("storage", { key: k }));
      }, [roomQ]);
      await her.waitForTimeout(400);
      await shot(her, "her-vote-and-reply");
    });
    await step("her sweep", async () => {
      await her.goto(B + `?store=local#s=${roomQ}`);
      await her.getByRole("button", { name: "יאללה" }).waitFor();
      await shot(her, "her-sweep-intro");
      await her.getByRole("button", { name: "יאללה" }).click();
      await shot(her, "her-sweep-card");
      await her.locator('[data-on="finish"]').click();
      await shot(her, "her-sweep-extras");
    });
    await step("error", async () => {
      await her.goto(B + "#q=<bad>");
      await her.getByRole("alert").waitFor();
      await shot(her, "error-screen");
    });
    console.log("PROBLEMS " + scheme + ": " + JSON.stringify(problems, null, 1));
    await ctx.close();
  });
}
