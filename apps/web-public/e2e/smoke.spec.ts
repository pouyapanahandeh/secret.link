import { test, expect } from "@playwright/test";

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

  test("signup redirects to onboarding", async ({ page }) => {
    const handle = `pw${Date.now().toString(36).slice(-8)}`;
    await page.goto("/signup");
    await page.fill("#handle", handle);
    await page.getByRole("button", { name: /Claim @handle/i }).click();
    await page.waitForURL(/\/onboarding/);
    await expect(page.getByText(/@handle/i)).toBeVisible();
  });
});
