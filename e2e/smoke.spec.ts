import { test, expect } from "@playwright/test";

test.describe("PartyUp smoke (Doc 05)", () => {
  test("home page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/PartyUp/i);
    await expect(page.getByRole("navigation")).toBeVisible();
  });

  test("games catalog", async ({ page }) => {
    await page.goto("/games");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("login page", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /entrar/i })).toBeVisible();
  });

  test("rankings page", async ({ page }) => {
    await page.goto("/rankings");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
