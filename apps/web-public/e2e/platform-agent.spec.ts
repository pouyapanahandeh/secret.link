/**
 * Platform QA agent — creates a fresh account and walks core product flows.
 *
 * Run: pnpm --filter @secretlink/web-public test:e2e e2e/platform-agent.spec.ts
 */
import { test, expect, type Browser, type Page } from "@playwright/test";
import {
  uniqueHandle,
  signupNewAccount,
  completeOnboardingToDashboard,
} from "./helpers/account";

test.describe.configure({ mode: "serial" });
test.setTimeout(90_000);

test.describe("platform agent — signup + feature walkthrough", () => {
  let handle: string;
  let ownerPage: Page;
  let browser: Browser;
  const profileSecret = `agent-profile-secret-${Date.now()}`;
  const linkSecret = `agent-link-secret-${Date.now()}`;

  test.beforeAll(async ({ browser: b }) => {
    browser = b;
    handle = uniqueHandle("agent");
    ownerPage = await browser.newPage();
  });

  test.afterAll(async () => {
    await ownerPage?.close();
  });

  test("1. landing sells claim-handle funnel", async () => {
    await ownerPage.goto("/");
    await expect(ownerPage).toHaveTitle(/Say what you really mean/i);
    await expect(ownerPage.getByRole("heading", { name: /Say what you\s+really mean/i })).toBeVisible();
    await expect(ownerPage.getByRole("link", { name: /^Get your @handle$/i }).first()).toBeVisible();
    await expect(ownerPage.getByRole("link", { name: /^Send a secret$/i }).first()).toBeVisible();
    await expect(ownerPage.getByRole("heading", { name: /How it works/i })).toBeVisible();
    await expect(ownerPage.getByRole("heading", { name: /^Claim your @handle$/i })).toBeVisible();
    await expect(ownerPage.getByText(/Want people to send you secrets/i)).toBeVisible();
  });

  test("2. signup requires 16+ then creates account", async () => {
    await ownerPage.goto("/signup");
    await ownerPage.fill("#handle", handle);
    const claim = ownerPage.getByRole("button", { name: /Claim @handle/i });
    await expect(claim).toBeDisabled();
    const ageBox = ownerPage.locator('input[name="ageConfirmed"]');
    await ageBox.check();
    await expect(ageBox).toBeChecked();
    await expect(claim).toBeEnabled();
    await Promise.all([
      ownerPage.waitForURL(/\/onboarding/, { timeout: 30_000 }),
      claim.click(),
    ]);
    await expect(ownerPage.getByText(new RegExp(`@${handle}`, "i"))).toBeVisible();
  });

  test("3. onboarding: share modal then dashboard", async () => {
    await expect(ownerPage.getByText(/Step 1 of 3/i)).toBeVisible();
    await ownerPage.getByRole("button", { name: /Continue →/i }).click();
    await expect(ownerPage.getByText(/Make it yours/i)).toBeVisible();
    await ownerPage.getByRole("button", { name: /^Cancel$/i }).click();
    await expect(ownerPage.getByText(/Share your profile/i)).toBeVisible();

    await ownerPage.getByRole("button", { name: /Open share options/i }).click();
    await expect(ownerPage.getByRole("dialog", { name: /Share profile/i })).toBeVisible();
    await ownerPage.getByRole("button", { name: /^Close$/i }).click();
    await expect(ownerPage.getByRole("dialog", { name: /Share profile/i })).toBeHidden();

    // Ensure receive key publish has a chance to complete (also fires on mount)
    await ownerPage.waitForTimeout(1_500);

    await ownerPage.goto("/dashboard");
    await ownerPage.waitForURL(/\/dashboard/);
    await expect(ownerPage.getByRole("heading", { name: new RegExp(`@${handle}`) })).toBeVisible({
      timeout: 15_000,
    });
    await expect(ownerPage.getByText(/📥 Inbox/i)).toBeVisible();
    await expect(
      ownerPage.getByText(/No secrets yet|Share your link on Instagram or TikTok/i).first(),
    ).toBeVisible();
  });

  test("4. dashboard copies canonical profile URL", async () => {
    await ownerPage.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await ownerPage.getByRole("button", { name: /^Copy$/i }).click();
    const clip = await ownerPage.evaluate(() => navigator.clipboard.readText());
    expect(clip).toMatch(new RegExp(`https?://[^/]+/${handle}$`));
    expect(clip).not.toContain(`/@${handle}`);
  });

  test("5. guest sends anonymous secret to profile", async () => {
    const guest = await browser.newPage();
    try {
      await guest.goto(`/${handle}`);
      await expect(guest.getByText(/Send an anonymous secret/i)).toBeVisible();
      await expect(guest.getByText(/Want your own anonymous inbox/i)).toBeVisible();
      await expect(guest.getByRole("link", { name: /Get your @handle/i })).toBeVisible();

      for (let attempt = 0; attempt < 5; attempt++) {
        await guest.fill('textarea[name="message"]', profileSecret);
        await guest.getByRole("button", { name: /Send anonymously/i }).click();
        const sent = guest.getByText(/Secret sent!/i);
        const notReady = guest.getByText(/hasn't set up secure delivery/i);
        await Promise.race([
          sent.waitFor({ state: "visible", timeout: 8_000 }).catch(() => null),
          notReady.waitFor({ state: "visible", timeout: 8_000 }).catch(() => null),
        ]);
        if (await sent.isVisible().catch(() => false)) break;
        if (await notReady.isVisible().catch(() => false)) {
          await ownerPage.goto("/dashboard");
          await ownerPage.waitForTimeout(1_000);
          await guest.reload();
          continue;
        }
        break;
      }

      await expect(guest.getByText(/Secret sent!/i)).toBeVisible({ timeout: 15_000 });
      await expect(
        guest.getByText(new RegExp(`delivered to\\s*@${handle}`, "i")),
      ).toBeVisible();
    } finally {
      await guest.close();
    }
  });

  test("6. owner reveals profile secret from inbox", async () => {
    await ownerPage.goto("/dashboard");
    await expect(ownerPage.getByText(/text secret/i).first()).toBeVisible({ timeout: 15_000 });
    await ownerPage.getByRole("link", { name: /text secret/i }).first().click();
    await ownerPage.waitForURL(/\/s\//);
    await expect(ownerPage.getByText(/You have a secret/i)).toBeVisible();
    await ownerPage.getByRole("button", { name: /Reveal secret/i }).click();
    await expect(ownerPage.getByText(profileSecret)).toBeVisible({ timeout: 15_000 });
    await expect(ownerPage.getByRole("link", { name: /Get your @handle/i })).toBeVisible();
  });

  test("7. create link secret on /send and reveal it", async () => {
    const guest = await browser.newPage();
    try {
      await guest.goto("/send");
      await expect(guest.getByRole("heading", { name: /Send a\s+secret/i })).toBeVisible();
      await guest.selectOption("#viewDuration", "300");
      await guest.fill("#message", linkSecret);
      await guest.getByRole("button", { name: /Create secret link/i }).click();
      await expect(guest.getByText(/Secret created!/i)).toBeVisible({ timeout: 20_000 });
      await expect(
        guest.getByRole("link", { name: /Get your @handle and share your inbox/i }),
      ).toBeVisible();

      const linkText = await guest.locator("p.text-success.font-mono, .text-success.font-mono").first().innerText();
      const secretUrl = linkText.trim();
      expect(secretUrl).toMatch(/\/s\/[^#\s]+#k=/);

      await guest.goto(secretUrl);
      await expect(guest.getByText(/You have a secret/i)).toBeVisible();
      await guest.getByRole("button", { name: /Reveal secret/i }).click();
      await expect(guest.getByText(linkSecret)).toBeVisible({ timeout: 15_000 });
      await expect(guest.getByRole("link", { name: /Get your @handle/i })).toBeVisible();
    } finally {
      await guest.close();
    }
  });

  test("8. dashboard map tab loads", async () => {
    await ownerPage.goto("/dashboard#map");
    // Map tab should mount without crashing; assert common chrome
    await expect(ownerPage.locator("body")).toBeVisible();
    await ownerPage.waitForTimeout(1_500);
    const mapHint = ownerPage.getByText(
      /Stories|Map|nearby|Locate|Add story|No stories/i,
    );
    await expect(mapHint.first()).toBeVisible({ timeout: 15_000 });
  });

  test("9. second account helper path still works", async () => {
    const page = await browser.newPage();
    try {
      const other = uniqueHandle("agent2");
      await signupNewAccount(page, other);
      await completeOnboardingToDashboard(page);
      await expect(page.getByRole("heading", { name: new RegExp(`@${other}`) })).toBeVisible();
    } finally {
      await page.close();
    }
  });
});
