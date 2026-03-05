import { test, expect } from "@playwright/test";

test.describe("Auth flow", () => {
  test("login page loads", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page).toHaveTitle(/Twobrains|Login/i);
    await expect(page.getByRole("heading", { name: /log in|sign in/i })).toBeVisible();
  });

  test("unauthenticated redirect to login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
