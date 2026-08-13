import { expect, type Page, test } from "@playwright/test";

/** Dismiss location onboarding overlay when it blocks the viewport. */
async function dismissLocationOnboarding(page: Page) {
  const dialog = page.getByRole("dialog");
  if (!(await dialog.isVisible().catch(() => false))) return;
  const notNow = dialog.getByRole("button", { name: "Choose city instead" });
  if (await notNow.isVisible().catch(() => false)) {
    await notNow.click();
    return;
  }
  await dialog.getByRole("button", { name: "Close" }).click();
}

test.describe("Customer public journeys (RC1)", () => {
  test("landing page loads without console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    const response = await page.goto("/en");
    expect(response?.ok()).toBeTruthy();
    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByRole("link").first()).toBeVisible();
    expect(errors.filter((e) => !e.includes("favicon"))).toEqual([]);
  });

  test("language switch en → ar updates locale prefix", async ({ page }) => {
    await page.goto("/en");
    await dismissLocationOnboarding(page);
    const switcher = page.locator("header").getByRole("button", { name: "العربية" });
    await expect(switcher).toBeVisible();
    await switcher.click();
    // After switch, control offers English (current locale is Arabic)
    await expect(page.locator("header").getByRole("button", { name: "English" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });

  test("theme toggle cycles without crashing", async ({ page }) => {
    await page.goto("/en");
    await dismissLocationOnboarding(page);
    const toggle = page.getByRole("button", { name: "Theme" }).first();
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.locator("html")).toBeVisible();
  });

  test("login page renders form controls", async ({ page }) => {
    await page.goto("/en/login");
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.getByRole("link", { name: /forgot|نسيت/i })).toBeVisible();
  });

  test("register page renders", async ({ page }) => {
    const response = await page.goto("/en/register");
    expect(response?.ok()).toBeTruthy();
    await expect(page.locator("#email")).toBeVisible();
  });

  test("forgot password page renders", async ({ page }) => {
    const response = await page.goto("/en/forgot-password");
    expect(response?.ok()).toBeTruthy();
    await expect(page.locator("#email")).toBeVisible();
  });

  test("search page loads", async ({ page }) => {
    const response = await page.goto("/en/search");
    expect(response?.ok()).toBeTruthy();
    await expect(page.locator("body")).toBeVisible();
  });

  test("business registration page loads", async ({ page }) => {
    const response = await page.goto("/en/register/business");
    expect(response?.ok()).toBeTruthy();
    await expect(page.locator("body")).toBeVisible();
  });
});
