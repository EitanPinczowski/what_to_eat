// Live-site check after deploy (CI job `live`). Run: LIVE_URL=https://... npx playwright test -c playwright.live.config.js
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e-live",
  timeout: 240000,
  retries: 1,
  use: { baseURL: process.env.LIVE_URL || "https://eitanpinczowski.github.io/what_to_eat/", locale: "he-IL" },
  projects: [{ name: "live-chromium", use: { ...devices["Pixel 7"] } }],
});
