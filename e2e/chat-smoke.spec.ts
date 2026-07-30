import { expect, test } from "@playwright/test";

/**
 * RC2.1 — chat surface smoke (auth / availability).
 * Deep participant authz is covered by verify:chat structural gates.
 */
test.describe("Chat smoke", () => {
  test("messages route does not 500 unauthenticated", async ({ page }) => {
    const response = await page.goto("/en/messages");
    expect(response?.status() ?? 0).toBeLessThan(500);
    await expect(page.locator("body")).toBeVisible();
  });

  test("login required paths for business still redirect", async ({ page }) => {
    await page.goto("/en/business");
    await expect(page).toHaveURL(/\/(en|ar)\/login/);
  });
});
