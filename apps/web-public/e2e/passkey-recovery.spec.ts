import { test, expect, type Page } from "@playwright/test";
import { uniqueHandle, signupNewAccount } from "./helpers/account";

async function addVirtualAuthenticator(page: Page): Promise<void> {
  const client = await page.context().newCDPSession(page);
  await client.send("WebAuthn.enable");
  await client.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
}

test.describe("passkey onboarding and recovery", () => {
  test("onboarding shows passkey step and skip reaches dashboard", async ({ page }) => {
    const handle = uniqueHandle("loc");
    await signupNewAccount(page, handle);
    await expect(page.getByText(/Step 1 of 5/i)).toBeVisible();
    await page.getByRole("button", { name: /Continue →/i }).click();
    await expect(page.getByRole("heading", { name: /Add a passkey/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Add passkey/i })).toBeVisible();
    await page.getByRole("button", { name: /Skip for now/i }).click();
    await expect(page.getByText(/Make it yours/i)).toBeVisible();
    await page.getByRole("button", { name: /^Cancel$/i }).click();
    await expect(page.getByText(/Share your profile/i)).toBeVisible();
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: new RegExp(`@${handle}`) })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: /Add passkey/i })).toBeVisible();
  });

  test("settings Sign-in is available without a passkey", async ({ page }) => {
    const handle = uniqueHandle("set");
    await signupNewAccount(page, handle);
    await page.getByRole("button", { name: /Continue →/i }).click();
    await page.getByRole("button", { name: /Skip for now/i }).click();
    await page.getByRole("button", { name: /^Cancel$/i }).click();
    await page.goto(`/${handle}`);
    await page.getByRole("button", { name: /Profile settings/i }).click();
    await expect(page.getByRole("dialog", { name: /Profile settings/i })).toBeVisible();
    await expect(page.getByText(/Sign-in/i)).toBeVisible();
    await expect(page.getByText(/No passkey yet/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Add passkey$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Generate recovery codes/i })).toBeVisible();
  });

  test("enroll passkey on onboarding, then recover with a code", async ({ page }) => {
    const handle = uniqueHandle("pk");
    await signupNewAccount(page, handle);
    await addVirtualAuthenticator(page);
    await page.getByRole("button", { name: /Continue →/i }).click();
    await expect(page.getByRole("heading", { name: /Add a passkey/i })).toBeVisible();
    const verifyWait = page.waitForResponse(
      (res) => res.url().includes("/passkey/register-verify") && res.request().method() === "POST",
    );
    await page.getByRole("button", { name: /Add passkey/i }).click();
    const verifyRes = await verifyWait;
    expect(verifyRes.ok()).toBeTruthy();
    await expect(page.getByText(/Save your recovery codes/i)).toBeVisible({ timeout: 20_000 });
    const firstCode = (await page.locator("ul li").first().textContent())?.trim() ?? "";
    expect(firstCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    await page.getByRole("checkbox", { name: /I saved these codes/i }).check();
    await page.getByRole("button", { name: /Continue/i }).click();
    await expect(page.getByText(/Make it yours/i)).toBeVisible();

    await page.goto("/login");
    await page.getByRole("button", { name: /Can't use your passkey/i }).click();
    await page.locator("#recovery-handle").fill(handle);
    await page.locator("#recovery-code").fill(firstCode);
    await page.getByRole("button", { name: /Continue with recovery code/i }).click();
    await expect(page).toHaveURL(/\/recover-passkey/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /Add a new passkey/i })).toBeVisible();
    await page.getByRole("button", { name: /Add passkey/i }).click();
    await expect(page.getByText(/Save your recovery codes/i)).toBeVisible({ timeout: 20_000 });
  });
});
