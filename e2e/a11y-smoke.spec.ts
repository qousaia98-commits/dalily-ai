import { expect, test } from "@playwright/test";

test.describe("Accessibility smoke (RC1)", () => {
  test("login form fields are labeled and keyboard-focusable", async ({ page }) => {
    await page.goto("/en/login");
    await page.locator("#email").focus();
    await expect(page.locator("#email")).toBeFocused();
    await page.keyboard.press("Tab");
    // Password or toggle may receive focus next
    const focused = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
    expect(focused).toBeTruthy();
    await expect(page.locator('label[for="email"]')).toBeVisible();
    await expect(page.locator('label[for="password"]')).toBeVisible();
  });

  test("landing has main landmark", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByRole("main")).toHaveCount(1);
  });
});
