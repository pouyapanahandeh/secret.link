import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "pnpm --filter @secretlink/api-gateway dev",
      port: 4000,
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: "test",
        JWT_SECRET: "ci-test-secret-not-used-in-prod",
        MASTER_KEY: "dGVzdC1rZXktdGVzdC1rZXktdGVzdC1rZXktMzI=",
        PORT: "4000",
      },
    },
    {
      command: "pnpm --filter @secretlink/web-public dev",
      port: 3000,
      reuseExistingServer: !process.env.CI,
      env: {
        API_URL: "http://localhost:4000",
        SESSION_SECRET: "playwright-test-session-secret",
      },
    },
  ],
});
