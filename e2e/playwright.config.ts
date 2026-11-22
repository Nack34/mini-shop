import { defineConfig, devices } from "@playwright/test";

/**
 * The whole shop: NestJS API (in-memory DB, fake payment provider) + the built Next.js app.
 * Locally: CHROME_PATH=/usr/bin/google-chrome to use an installed Chrome.
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1, // tests share the API's stock
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
      },
    },
  ],
  webServer: [
    {
      command: "npm run build && npm start",
      cwd: "../api",
      env: { PORT: "4000", WEB_URL: "http://localhost:3000" },
      url: "http://localhost:4000/products",
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: "npx next build && npx next start -p 3000",
      cwd: "../web",
      env: { NEXT_PUBLIC_API_URL: "http://localhost:4000", NEXT_TELEMETRY_DISABLED: "1" },
      url: "http://localhost:3000/cart",
      timeout: 300_000,
      reuseExistingServer: false,
    },
  ],
});
