import { expect, test } from "@playwright/test";

/**
 * Middleware enforces login only for /business and /admin when unauthenticated.
 * Customer /account and /messages rely on page-level session handling.
 */

const loginRequiredPaths = [
  "/en/business",
  "/en/business/profile",
  "/en/admin",
  "/en/admin/users",
];

const publicOrSoftGatePaths = [
  "/en/account",
  "/en/account/bookings",
  "/en/messages",
  "/en/request/new",
];

test.describe("Auth guards (RC1)", () => {
  for (const path of loginRequiredPaths) {
    test(`unauthenticated ${path} redirects to login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/(en|ar)\/login/);
    });
  }

  for (const path of publicOrSoftGatePaths) {
    test(`unauthenticated ${path} does not 500`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status() ?? 0).toBeLessThan(500);
      await expect(page.locator("body")).toBeVisible();
    });
  }

  test("login with empty fields stays on login (no 500)", async ({ page }) => {
    await page.goto("/en/login");
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Authenticated journeys (skipped without credentials)", () => {
  const hasCreds = Boolean(process.env.E2E_USER_EMAIL && process.env.E2E_USER_PASSWORD);

  test.skip(!hasCreds, "Set E2E_USER_EMAIL / E2E_USER_PASSWORD to run");

  test("customer login succeeds", async ({ page }) => {
    await page.goto("/en/login");
    await page.locator("#email").fill(process.env.E2E_USER_EMAIL!);
    await page.locator("#password").fill(process.env.E2E_USER_PASSWORD!);
    await page.locator('button[type="submit"]').click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
  });
});
