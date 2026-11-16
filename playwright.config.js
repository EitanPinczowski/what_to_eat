import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 30000,
  retries: 1,
  // Screenshot baselines are per platform (-win32 / -linux). CI writes the ones it lacks; elsewhere e2e/screens.spec.js skips screens with no baseline.
  updateSnapshots: process.env.CI ? "missing" : "none",
  use: { baseURL: "http://localhost:8000", locale: "he-IL" },
  webServer: {
    command: "node tools/serve.mjs",
    url: "http://localhost:8000",
    reuseExistingServer: true,
    timeout: 20000,
  },
  projects: [
    { name: "pixel", use: { ...devices["Pixel 7"] } },
    { name: "iphone", use: { ...devices["iPhone 14"] } },
  ],
});
