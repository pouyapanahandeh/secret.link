import type { Page } from "@playwright/test";

/** Unique handle safe for signup validation (3–32, a-z0-9_-). */
export function uniqueHandle(prefix = "qa"): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(0, 32);
}

/** Create a new account via /signup (requires 16+ checkbox). Lands on /onboarding. */
export async function signupNewAccount(page: Page, handle: string): Promise<void> {
  await page.goto("/signup");
  await page.fill("#handle", handle);
  await page.locator('input[name="ageConfirmed"]').check();
  await Promise.all([
    page.waitForURL(/\/onboarding/, { timeout: 30_000 }),
    page.getByRole("button", { name: /Claim @handle/i }).click(),
  ]);
}

/** Finish onboarding through share step and open dashboard. */
export async function completeOnboardingToDashboard(page: Page): Promise<void> {
  await page.getByRole("button", { name: /Continue →/i }).click();
  await page.getByText(/Make it yours/i).waitFor({ state: "visible" });
  // Skip profile edit — Cancel advances to share step
  await page.getByRole("button", { name: /^Cancel$/i }).click();
  await page.getByText(/Share your profile/i).waitFor({ state: "visible" });
  // Give ensureAndPublishKey time to finish before friends send
  await page.waitForTimeout(1_500);
  await page.goto("/dashboard");
  await page.waitForURL(/\/dashboard/);
}
