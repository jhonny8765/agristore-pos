import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("Better Yield sign-in loads local business assets and reflows accessibly", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Welcome to your store." })).toBeVisible();
  await expect(page).toHaveTitle("Better Yield POS");
  for (const width of [1440, 1024, 390, 418, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const brand = page.locator(width > 730 ? ".auth-story .store-logo" : ".small-brand .store-logo");
    await expect(brand).toBeVisible();
    await expect(brand).toHaveJSProperty("naturalWidth", 1242);
    if (width > 730) {
      await expect(page.locator(".auth-photo img")).toHaveJSProperty("naturalWidth", 880);
      await expect(page.getByRole("link", { name: "Better Yield on Facebook" })).toHaveAttribute("href", "https://www.facebook.com/profile.php?id=100054562864276");
    }
    const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(scan.violations).toEqual([]);
  }
});
