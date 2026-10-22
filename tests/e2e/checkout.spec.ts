import { test, expect, chromium, type Page } from "@playwright/test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
async function practice(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Try practice checkout" }).click();
  await expect(
    page.getByRole("heading", { name: "Checkout", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add Grower feeds" }),
  ).toBeVisible();
}
async function buy(page: Page) {
  await page.getByRole("button", { name: "Add Grower feeds" }).click();
  await page.getByLabel("Cash received", { exact: true }).fill("2000");
  await page.getByRole("button", { name: "Complete cash sale" }).click();
  await expect(
    page.getByRole("heading", { name: "Sale saved." }),
  ).toBeVisible();
}
test("cash checkout stores a sale, distinct identical purchases, and change", async ({
  page,
}) => {
  await practice(page);
  await buy(page);
  await expect(page.getByText("₱420.00 change")).toBeVisible();
  await buy(page);
  await page.getByRole("button", { name: "Sales & receipts" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(2);
});
test("checkout survives offline reload and does not send practice sales", async ({
  page,
  context,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/rest/v1/rpc")) requests.push(r.url());
  });
  await practice(page);
  await page.waitForFunction(
    () =>
      !!navigator.serviceWorker.controller ||
      navigator.serviceWorker.ready.then(() => true),
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Add Grower feeds" }),
  ).toBeVisible();
  await context.setOffline(true);
  await buy(page);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Add Grower feeds" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sync center" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  expect(requests).toHaveLength(0);
});
test("expired authorization blocks a new sale and retains the old record", async ({
  page,
}) => {
  await practice(page);
  await buy(page);
  await page.clock.install();
  await page.clock.setSystemTime(Date.now() + 13 * 3600_000);
  await page.getByRole("button", { name: "Add Grower feeds" }).click();
  await page.getByLabel("Cash received", { exact: true }).fill("2000");
  await page.getByRole("button", { name: "Complete cash sale" }).click();
  await expect(page.locator(".notice[role=alert]")).toContainText(
    "Offline authorization expired",
  );
  await page.getByRole("button", { name: "Sync center" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
});
test("quantity conversion and cash underpayment validation", async ({
  page,
}) => {
  await practice(page);
  await page.getByRole("button", { name: "Add Grower feeds" }).click();
  await page
    .getByLabel("Unit for Grower feeds")
    .selectOption({ label: "Kilo" });
  await page.getByLabel("Quantity for Grower feeds").fill("2.5");
  await page.getByLabel("Cash received", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Complete cash sale" }).click();
  await expect(page.locator(".notice[role=alert]")).toContainText(
    "Cash received is below",
  );
  await page.getByLabel("Cash received", { exact: true }).fill("100");
  await page.getByRole("button", { name: "Complete cash sale" }).click();
  await expect(
    page.getByRole("heading", { name: "Sale saved." }),
  ).toBeVisible();
});
test("real browser process restart retains the local outbox", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "agri-browser-"));
  let context = await chromium.launchPersistentContext(directory, {
    headless: true,
  });
  try {
    let page = context.pages()[0];
    await page.goto("http://127.0.0.1:3100");
    await page.getByRole("button", { name: "Try practice checkout" }).click();
    await buy(page);
    await context.close();
    context = await chromium.launchPersistentContext(directory, {
      headless: true,
    });
    page = context.pages()[0];
    await page.goto("http://127.0.0.1:3100");
    await expect(
      page.getByRole("button", { name: "Add Grower feeds" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Sync center" }).click();
    await expect(page.locator("tbody tr")).toHaveCount(1);
  } finally {
    await context.close();
    await rm(directory, { recursive: true, force: true });
  }
});
test("desktop and mobile inspection captures with no horizontal page overflow", async ({
  page,
}) => {
  await mkdir(".impeccable/review", { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1050 });
  await practice(page);
  await page.screenshot({
    path: ".impeccable/review/desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "Checkout", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".impeccable/review/mobile.png",
    fullPage: true,
  });
});
test("200 browser checkouts persist through a simulated hour offline", async ({
  page,
  context,
}) => {
  test.setTimeout(180_000);
  await practice(page);
  await page.waitForFunction(() =>
    navigator.serviceWorker.ready.then(() => true),
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Add Grower feeds" }),
  ).toBeVisible();
  await context.setOffline(true);
  for (let i = 0; i < 200; i++) await buy(page);
  await page.clock.install();
  await page.clock.setSystemTime(Date.now() + 3600_000);
  await page.reload();
  await page.getByRole("button", { name: "Sync center" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(200);
});
