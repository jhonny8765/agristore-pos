import { test, expect } from "@playwright/test";

test("receipt pages preserve every sale, exact cash and available stock", async ({ page }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Try practice checkout", exact: true }).click();
  for (let n = 0; n < 11; n++) {
    await page.getByRole("button", { name: "Add Grower feeds" }).click();
    await page.getByLabel("Cash received", { exact: true }).fill("2000");
    await page.getByRole("button", { name: "Complete cash sale", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Sale saved.", exact: true })).toBeVisible();
  }
  const saved = () => page.evaluate(() => new Promise<{ id: string; payload: { total: number; cashReceived: number } }[]>((resolve, reject) => {
    const open = indexedDB.open("agristore-practice-v1"); open.onsuccess = () => { const db = open.result, tx = db.transaction("sales", "readonly"), request = tx.objectStore("sales").getAll(); request.onsuccess = () => resolve(request.result); tx.oncomplete = () => db.close(); tx.onerror = () => reject(tx.error); }; open.onerror = () => reject(open.error);
  }));
  const originals = await saved(); expect(originals).toHaveLength(11); expect(new Set(originals.map(s => s.id)).size).toBe(11);
  expect(originals.reduce((n, s) => n + s.payload.total, 0)).toBe(1738000);
  expect(originals.reduce((n, s) => n + s.payload.cashReceived, 0)).toBe(2200000);
  await page.getByRole("button", { name: "Inventory", exact: true }).click();
  const stock = page.getByRole("row").filter({ hasText: "Grower feeds" }).locator("td").nth(2);
  await expect(stock).toHaveText("1550 kg");
  await page.getByRole("button", { name: "Sales & receipts", exact: true }).click();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const pager = page.getByRole("navigation", { name: /^Table records:.* pages above$/ });
    await expect(page.locator("tbody tr")).toHaveCount(10);
    await pager.getByRole("button", { name: "Next", exact: true }).click(); await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(pager).toContainText("11–11 of 11 loaded");
    await pager.getByRole("button", { name: "Previous", exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `.impeccable/review/receipt-pages-${width}.png`, fullPage: true });
  }
  await page.getByRole("button", { name: /^Sync center(?:\s+\d+)?$/ }).click();
  await expect(page.locator("tbody tr")).toHaveCount(10);
  expect(await saved()).toEqual(originals);
  await page.getByRole("button", { name: "Inventory", exact: true }).click(); await expect(stock).toHaveText("1550 kg");
});
