import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 30000,
  retries: 1,
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
