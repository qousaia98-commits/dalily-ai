import { expect, test } from "@playwright/test";

test.describe("Static public routes (RC1)", () => {
  const routes = [
    "/en",
    "/ar",
    "/en/login",
    "/en/register",
    "/en/forgot-password",
    "/en/reset-password",
    "/en/search",
    "/en/privacy",
    "/en/terms",
    "/en/register/business",
    "/en/ai",
  ];

  for (const route of routes) {
    test(`${route} returns < 500`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));
      const response = await page.goto(route);
      expect(response?.status() ?? 0).toBeLessThan(500);
      await expect(page.locator("body")).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
});
