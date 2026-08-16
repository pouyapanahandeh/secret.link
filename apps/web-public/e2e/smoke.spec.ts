import { test, expect } from "@playwright/test";
import { uniqueHandle, signupNewAccount } from "./helpers/account";

test.describe("public smoke", () => {
  test("landing, robots, and API health", async ({ page, request }) => {
    const health = await request.get("http://localhost:4000/v1/health");
    expect(health.ok()).toBeTruthy();
    const healthBody = await health.json();
    expect(healthBody.status).toBe("ok");

    await page.goto("/");
    await expect(page).toHaveTitle(/Secretlink/i);

    const robots = await request.get("/robots.txt");
    expect(robots.ok()).toBeTruthy();
    const robotsText = await robots.text();
    expect(robotsText).toContain("Sitemap");
  });

  test("signup with 16+ redirects to onboarding", async ({ page }) => {
    const handle = uniqueHandle("pw");
    await signupNewAccount(page, handle);
    await expect(page.getByText(new RegExp(`@${handle}`, "i"))).toBeVisible();
  });
});
