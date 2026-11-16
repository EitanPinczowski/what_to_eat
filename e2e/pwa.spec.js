// Item 33a: a new sw.js version takes over. The app shows the "new version, refresh?" bar; "refresh" reloads onto the new worker.
// Own static server on a free port, so the test can change the VERSION line of sw.js between loads without touching the repo.
import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.cwd());
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml" };

let server, base, version;
test.beforeAll(async () => {
  server = createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (p.endsWith("/")) p += "index.html";
      const file = normalize(join(root, p));
      if (!file.startsWith(root)) return res.writeHead(403).end();
      let body = await readFile(file);
      if (p === "/sw.js") body = body.toString().replace("__VERSION__", version);
      res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" }).end(body);
    } catch {
      res.writeHead(404).end("nf");
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://localhost:${server.address().port}`;
});
test.afterAll(() => server.close());
test.beforeEach(() => (version = "e2e-one"));

const controlled = (page) => page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 15000 });
const cacheNames = (page) => page.evaluate(async () => (await caches.keys()).filter((k) => k.startsWith("wte-")).sort());
// The worker claiming the page the first time fires controllerchange, which reloads it once (js/pwa.js); reload on purpose so the page is steady.
const install = async (page) => {
  await page.goto(`${base}/?store=local&sw`);
  await controlled(page);
  await page.reload();
  await controlled(page);
  await expect(page.locator("h1")).toHaveText("מה בא לך?");
};
const checkUpdate = (page) => page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());

test("a new sw.js version shows the update bar; refresh reloads onto the new version", async ({ page }) => {
  await install(page);
  await expect(page.locator(".update-bar")).toHaveCount(0);
  await expect.poll(() => cacheNames(page)).toEqual(["wte-e2e-one"]);
  await page.evaluate(() => (window.__marker = "before"));

  version = "e2e-two";
  await checkUpdate(page);
  const bar = page.locator(".update-bar");
  await expect(bar).toBeVisible({ timeout: 15000 });
  await expect(bar).toContainText("גרסה חדשה");
  expect(await page.evaluate(() => window.__marker)).toBe("before"); // never reloads by itself

  await bar.locator('[data-k="yes"]').click();
  await page.waitForFunction(() => window.__marker === undefined, null, { timeout: 15000 }); // the page reloaded
  await controlled(page);
  await expect(page.locator("h1")).toHaveText("מה בא לך?");
  await expect.poll(() => cacheNames(page)).toEqual(["wte-e2e-two"]); // old cache swept on activate
  await expect(page.locator(".update-bar")).toHaveCount(0);
});

test("\"later\" keeps the page as it is", async ({ page }) => {
  await install(page);
  await page.evaluate(() => (window.__marker = "kept"));
  version = "e2e-three";
  await checkUpdate(page);
  await expect(page.locator(".update-bar")).toBeVisible({ timeout: 15000 });
  await page.locator('.update-bar [data-k="later"]').click();
  await expect(page.locator(".update-bar")).toHaveCount(0);
  expect(await page.evaluate(() => window.__marker)).toBe("kept");
});
