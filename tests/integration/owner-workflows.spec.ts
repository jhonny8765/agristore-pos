import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { salesPage } from "../../apps/web/lib/api";
import { historyPage } from "../../apps/web/lib/history-api";
import type { HistoryCursor, HistoryKind } from "../../apps/web/lib/history";
import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import type { Product } from "@agristore/domain";

const api = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (
  process.env.AGRISTORE_LOCAL_INTEGRATION !== "1" ||
  api !== "http://127.0.0.1:55321" ||
  !key
)
  throw new Error(
    "Owner workflow fixtures must use the disposable loopback database.",
  );

async function command<T = Record<string, unknown>>(
  owner: SupabaseClient,
  action: string,
  data: Record<string, unknown>,
): Promise<T> {
  const result = await owner.rpc("agri_command", { action, data });
  if (result.error) throw new Error(`${action}: ${result.error.message}`);
  return result.data as T;
}
async function business(
  productName = "Audit feeds",
  units = [{ name: "Kilo", factor: "1", price: 100, cost: 50 }],
) {
  const owner = createClient(api!, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `audit-${randomUUID()}@example.com`;
  // Spaces are intentional: the UI must preserve a user's exact password.
  const password = ` Agri-${randomUUID()}! `;
  const signup = await owner.auth.signUp({ email, password });
  if (signup.error || !signup.data.session)
    throw new Error("Disposable owner signup failed.");
  const { organizationId } = await command<{ organizationId: string }>(
    owner,
    "bootstrap",
    { name: `TEST audit ${randomUUID()}`, ownerName: "Test audit owner" },
  );
  const branches = await owner
    .from("branches")
    .select("id,code")
    .eq("organization_id", organizationId)
    .order("code");
  expect(branches.error).toBeNull();
  const branchId = branches.data![0].id as string;
  const { id: productId } = await command<{ id: string }>(
    owner,
    "create_product",
    {
      organizationId,
      branchId,
      name: productName,
      sku: "AUDIT-FEED",
      category: "Feeds",
      baseUnit: "kg",
      minimumStock: "0",
      tracksExpiry: false,
      units,
    },
  );
  const unit = await owner
    .from("product_units")
    .select("id")
    .eq("product_id", productId)
    .eq("name", "Kilo")
    .single();
  expect(unit.error).toBeNull();
  await command(owner, "receive_stock", {
    organizationId,
    branchId,
    receiptId: randomUUID(),
    source: "purchase",
    reference: "TEST audit fixture stock",
    items: [
      {
        productId,
        unitId: unit.data!.id,
        quantity: "10000",
        lot: "",
        expiresOn: null,
      },
    ],
  });
  return {
    owner,
    email,
    password,
    organizationId,
    branchId,
    productId,
    unitId: unit.data!.id as string,
    branches: branches.data!,
  };
}
async function login(
  page: Page,
  account: Awaited<ReturnType<typeof business>>,
  productName = "Audit feeds",
) {
  await page.getByLabel("Email address", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("button", { name: `Add ${productName}`, exact: true }),
  ).toBeVisible();
}
async function closeShift(page: Page) {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByLabel("Cash counted in drawer (₱)", { exact: true })
    .fill("0");
  await page
    .getByRole("button", { name: "Reconcile & close shift", exact: true })
    .click();
  await expect(
    page.getByText("No cashier shift is open. Open one from Checkout.", {
      exact: true,
    }),
  ).toBeVisible();
}

test("owner product setup creates only enabled selling units with independent retail prices", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const a = await business();
  await page.goto("/");
  await login(page, a);
  await page.getByRole("button", { name: "Inventory", exact: true }).click();
  const form = page.getByRole("form", { name: "Add a product", exact: true });
  await form
    .getByLabel("Product name", { exact: true })
    .fill("TEST 25 kg feeds");
  await form.getByLabel("SKU / barcode", { exact: true }).fill("TEST-SETUP-25");
  await form.getByLabel("How customers buy this product").selectOption("sack");
  await expect(form.getByLabel("Also sell loose kilos")).not.toBeChecked();
  await expect(
    form.getByLabel("Price per kilo (₱)", { exact: true }),
  ).toHaveCount(0);
  await form.getByLabel("Number of kg in one Sack").fill("25");
  await form.getByLabel("Price per Sack (₱)", { exact: true }).fill("900");
  await form.getByLabel("Cost per Sack (₱)", { exact: true }).fill("700");
  await form.getByLabel("Also sell loose kilos").check();
  await form.getByLabel("Price per kilo (₱)", { exact: true }).fill("45");
  await form.getByLabel("Cost per kilo (₱)", { exact: true }).fill("28");
  await expect(form.locator(".setup-summary")).toContainText("1 Sack = 25 kg");
  for (const width of [1440, 390, 418, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const scan = await new AxeBuilder({ page })
      .include(".product-setup")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(scan.violations).toEqual([]);
  }
  await form.getByRole("button", { name: "Add product", exact: true }).click();
  await expect(form.getByRole("status")).toContainText(
    "TEST 25 kg feeds added",
  );
  await expect(form.getByLabel("Product name", { exact: true })).toHaveValue(
    "",
  );
  await form
    .getByLabel("Product name", { exact: true })
    .fill("TEST sealed nutrients");
  await form.getByLabel("SKU / barcode", { exact: true }).fill("TEST-SEALED");
  await form
    .getByLabel("How customers buy this product")
    .selectOption("sealed");
  await expect(form.getByLabel("Also sell loose kilos")).toHaveCount(0);
  await form.getByLabel("Price per Packet (₱)", { exact: true }).fill("60");
  await form.getByLabel("Cost per Packet (₱)", { exact: true }).fill("40");
  await form.getByRole("button", { name: "Add product", exact: true }).click();
  await expect(form.getByRole("status")).toContainText(
    "TEST sealed nutrients added",
  );
  const snapshot = await command<{ products: Product[] }>(a.owner, "snapshot", {
    organizationId: a.organizationId,
    branchId: a.branchId,
    transactionIds: [],
  });
  const feed = snapshot.products.find(
    (product) => product.sku === "TEST-SETUP-25",
  )!;
  expect(feed.baseUnit).toBe("kg");
  expect(
    feed.units.map(({ name, factor, price, cost }) => ({
      name,
      factor,
      price,
      cost,
    })),
  ).toEqual(
    expect.arrayContaining([
      { name: "Sack", factor: "25.000000", price: 90000, cost: 70000 },
      { name: "Kilo", factor: "1.000000", price: 4500, cost: 2800 },
    ]),
  );
  expect(feed.units).toHaveLength(2);
  const packet = snapshot.products.find(
    (product) => product.sku === "TEST-SEALED",
  )!;
  expect(packet.baseUnit).toBe("piece");
  expect(packet.units).toHaveLength(1);
  expect(Number(packet.units[0].factor)).toBe(1);
  // A server-side duplicate refusal leaves the completed form recoverable.
  await form
    .getByLabel("Product name", { exact: true })
    .fill("TEST duplicate SKU");
  await form.getByLabel("SKU / barcode", { exact: true }).fill("TEST-SEALED");
  await form.getByLabel("Price per Packet (₱)", { exact: true }).fill("60");
  await form.getByLabel("Cost per Packet (₱)", { exact: true }).fill("40");
  await form.getByRole("button", { name: "Add product", exact: true }).click();
  await expect(form.getByRole("alert")).toContainText(
    "This SKU already exists",
  );
  await expect(form.getByLabel("Product name", { exact: true })).toHaveValue(
    "TEST duplicate SKU",
  );
  await page.getByRole("button", { name: "Checkout POS", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Sell TEST 25 kg feeds by weight",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Sell TEST sealed nutrients by weight",
      exact: true,
    }),
  ).toHaveCount(0);
});

test("offline mixed sacks, quarters, halves and peso-weight sales synchronize exact stock and retail prices", async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  const name = "TEST measured feeds";
  const a = await business(name, [
    { name: "Sack (50 kg)", factor: "50", price: 158000, cost: 138000 },
    { name: "Kilo", factor: "1", price: 3500, cost: 2760 },
  ]);
  await page.goto("/");
  await login(page, a, name);
  await page.getByRole("button", { name: "Open shift", exact: true }).click();
  const add = page.getByRole("button", { name: `Add ${name}`, exact: true });
  await expect(add).toBeEnabled();
  await context.setOffline(true);
  await add.click();
  await page
    .getByLabel(`Unit for ${name}`)
    .selectOption({ label: "Sack (50 kg)" });
  await add.click();
  await page.getByRole("button", { name: "¼ kg", exact: true }).nth(1).click();
  await add.click();
  await page.getByRole("button", { name: "½ kg", exact: true }).nth(2).click();
  await add.click();
  await page
    .getByRole("button", { name: "By peso amount", exact: true })
    .nth(3)
    .click();
  await page.getByLabel(`Customer budget for ${name}`).fill("50");
  await page
    .getByRole("button", { name: "Estimate weight", exact: true })
    .click();
  await expect(page.getByLabel(`Quantity for ${name}`).nth(3)).toHaveValue(
    "1.428",
  );
  await expect(
    page.getByRole("button", { name: "Complete cash sale" }),
  ).toBeDisabled();
  await page.getByLabel(`Weight entry for ${name}`).nth(2).selectOption("g");
  await page.getByLabel(`Quantity for ${name}`).nth(3).fill("1430");
  await page
    .getByRole("button", { name: "Confirm weighed amount", exact: true })
    .click();
  await page.getByLabel("Cash received", { exact: true }).fill("2000");
  await page
    .getByRole("button", { name: "Complete cash sale", exact: true })
    .click();
  await expect(page.getByText("₱343.70 change", { exact: true })).toBeVisible();
  // The success icon must not constrain the printable item list to 53px.
  const printed = page.locator(".receipt-print-details");
  await expect(printed).toBeHidden();
  await page.emulateMedia({ media: "print" });
  await expect(printed).toBeVisible();
  await expect(printed).toContainText("0.25 Kilo");
  await expect(printed).toContainText("0.5 Kilo");
  await expect(printed).toContainText("1.43 Kilo");
  const printLayout = await printed.evaluate((el) => {
    const details = el.getBoundingClientRect();
    const last = el.lastElementChild!.getBoundingClientRect();
    const footer = el.nextElementSibling!.getBoundingClientRect();
    return {
      width: details.width,
      fits: el.scrollWidth <= el.clientWidth,
      containsLines: last.bottom <= details.bottom,
      footerAfter: footer.top >= details.bottom,
    };
  });
  expect(printLayout.width).toBeGreaterThan(180);
  expect(printLayout.fits).toBe(true);
  expect(printLayout.containsLines).toBe(true);
  expect(printLayout.footerAfter).toBe(true);
  await page.emulateMedia({ media: "screen" });
  await expect(page.getByRole("article").filter({ has: add })).toContainText(
    "9947.82 kg on hand",
  );
  const before = await a.owner
    .from("sales")
    .select("id")
    .eq("organization_id", a.organizationId);
  expect(before.error).toBeNull();
  expect(before.data).toEqual([]);
  await context.setOffline(false);
  await page.getByRole("button", { name: "Sync center", exact: false }).click();
  await expect(page.locator(".status-tag")).toContainText("synced", {
    timeout: 60_000,
  });
  const saved = await a.owner
    .from("sales")
    .select("id,total,payload")
    .eq("organization_id", a.organizationId)
    .single();
  expect(saved.error).toBeNull();
  expect(Number(saved.data!.total)).toBe(165630);
  const items = saved.data!.payload.items;
  expect(items.map((item: { quantity: string }) => item.quantity)).toEqual([
    "1",
    "0.25",
    "0.5",
    "1.43",
  ]);
  expect(items.map((item: { unitPrice: number }) => item.unitPrice)).toEqual([
    158000, 3500, 3500, 3500,
  ]);
  const movements = await a.owner
    .from("inventory_movements")
    .select("quantity")
    .eq("source_id", saved.data!.id)
    .eq("kind", "sale");
  expect(movements.error).toBeNull();
  expect(
    movements.data!.map((row) => Number(row.quantity)).sort((x, y) => x - y),
  ).toEqual([-50, -1.43, -0.5, -0.25]);
  const stock = await a.owner
    .from("branch_inventory")
    .select("quantity")
    .eq("branch_id", a.branchId)
    .eq("product_id", a.productId)
    .single();
  expect(stock.error).toBeNull();
  expect(Number(stock.data!.quantity)).toBe(9947.82);
  await page.getByRole("button", { name: /^Checkout/ }).click();
  await expect(page.getByRole("article").filter({ has: add })).toContainText(
    "9947.82 kg on hand",
  );
  const retry = await command<{ status: string }>(
    a.owner,
    "record_sale",
    saved.data!.payload,
  );
  expect(retry.status).toBe("duplicate");
  const after = await a.owner
    .from("inventory_movements")
    .select("id")
    .eq("source_id", saved.data!.id)
    .eq("kind", "sale");
  expect(after.error).toBeNull();
  expect(after.data).toHaveLength(4);
});

test("owner accessibility covers keyboard navigation, narrow reflow and forced colors", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const a = await business();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const failures: {
    screen: string;
    mode: string;
    rule: string;
    targets: unknown[];
  }[] = [];
  async function scan(screen: string, mode: string) {
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    for (const violation of result.violations)
      failures.push({
        screen,
        mode,
        rule: violation.id,
        targets: violation.nodes.map((n) => n.target),
      });
  }
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await scan("Sign in", "desktop");
  await login(page, a);
  const skip = page.getByRole("link", {
    name: "Skip to main content",
    exact: true,
  });
  await skip.focus();
  await expect(skip).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
  await skip.focus();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", {
      name: "Better Yield Point of Sale home",
      exact: true,
    }),
  ).toBeFocused();
  function contrast(first: string, second: string) {
    const luminance = (color: string) =>
      (color.match(/[\d.]+/g) ?? [])
        .slice(0, 3)
        .map(Number)
        .map((v) => {
          v /= 255;
          return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        })
        .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    const left = luminance(first),
      right = luminance(second);
    return (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05);
  }
  const ring = await page
    .getByRole("link", { name: "Better Yield Point of Sale home", exact: true })
    .evaluate((el) => ({
      ring: getComputedStyle(el).outlineColor,
      background: getComputedStyle(el.closest(".sidebar")!).backgroundColor,
    }));
  expect(contrast(ring.ring, ring.background)).toBeGreaterThanOrEqual(3);
  const input = await page
    .getByLabel("Opening cash (₱)", { exact: true })
    .evaluate((el) => ({
      border: getComputedStyle(el).borderColor,
      background: getComputedStyle(el).backgroundColor,
    }));
  expect(contrast(input.border, input.background)).toBeGreaterThanOrEqual(3);
  await page.getByRole("button", { name: "Open shift", exact: true }).click();
  const addProduct = page.getByRole("button", {
    name: "Add Audit feeds",
    exact: true,
  });
  const productTile = page.locator(".product").filter({ has: addProduct });
  await expect(addProduct).toBeEnabled();
  // The tile remains a full-size pointer target; its named button is also
  // reachable by keyboard without treating every piece of metadata as a label.
  await productTile.click({ position: { x: 16, y: 16 } });
  await expect(
    page.getByRole("button", { name: "Remove Audit feeds", exact: true }),
  ).toBeVisible();
  await addProduct.focus();
  await expect(productTile).toHaveCSS("outline-style", "solid");
  await scan("Checkout with active cart", "desktop");
  for (const name of [
    "Remove Audit feeds",
    "Decrease Audit feeds",
    "Increase Audit feeds",
  ]) {
    const size = await page
      .getByRole("button", { name, exact: true })
      .boundingBox();
    expect(size!.width).toBeGreaterThanOrEqual(24);
    expect(size!.height).toBeGreaterThanOrEqual(24);
  }
  await page
    .getByRole("button", { name: "Remove Audit feeds", exact: true })
    .click();
  await page.getByRole("button", { name: "Feeds", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Feeds", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "All products", exact: true }).click();
  await closeShift(page);
  const screens = [
    "Checkout",
    "Overview",
    "Inventory",
    "Purchasing",
    "Transfers",
    "Stock counts",
    "Sales & receipts",
    "Sync center",
    "Settings",
  ];
  for (const screen of screens) {
    const navigationName = screen === "Checkout" ? "Checkout POS" : screen;
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page
      .getByRole("button", { name: navigationName, exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: navigationName, exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(page.locator("#main h1")).toBeFocused();
    if (
      ["Overview", "Purchasing", "Transfers", "Stock counts"].includes(screen)
    )
      await expect(page.locator(".history-register")).toContainText(/loaded ·/);
    if (screen === "Settings")
      await expect(
        page.getByRole("cell", { name: "Test audit owner", exact: true }),
      ).toBeVisible();
    await scan(screen, "desktop");
    const unnamed = await page
      .locator(".table-wrap")
      .evaluateAll(
        (nodes) =>
          nodes.filter(
            (el) =>
              el.getAttribute("role") !== "region" ||
              !el.getAttribute("aria-label") ||
              (el as HTMLElement).tabIndex !== 0,
          ).length,
      );
    expect(unnamed).toBe(0);
    for (const width of [640, 320]) {
      // 640 CSS pixels exercises the reflow width of 1280px at 200% page zoom.
      // This does not claim the in-app browser's zoom shortcut changed its scale.
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${screen} at ${width}px`,
      ).toBe(true);
      if (width === 320) await scan(screen, "320px reflow");
    }
    await page.emulateMedia({
      forcedColors: "active",
      reducedMotion: "reduce",
    });
    await expect(
      page.getByRole("button", { name: navigationName, exact: true }),
    ).toHaveCSS("border-top-style", "solid");
    await expect(
      page.getByRole("button", { name: navigationName, exact: true }),
    ).toHaveCSS("border-top-width", "2px");
    expect(
      await page.evaluate(() => matchMedia("(forced-colors: active)").matches),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.emulateMedia({
      forcedColors: "none",
      reducedMotion: "no-preference",
    });
  }
  expect(failures, JSON.stringify(failures, null, 2)).toEqual([]);
});

test("owner approvals work without browser dialogs, stock refreshes without a shift, and another account cannot see cached data", async ({
  page,
}) => {
  const a = await business();
  await page.goto("/");
  await login(page, a);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.getByRole("button", { name: "Open shift", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add Audit feeds", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Add Audit feeds", exact: true })
    .click();
  await page.getByLabel("Cash received", { exact: true }).fill("2");
  await page
    .getByRole("button", { name: "Complete cash sale", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sale saved.", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Sync center/ }).click();
  await expect(
    page.locator(".status-tag").filter({ hasText: /^synced$/ }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Sales & receipts", exact: true })
    .click();
  await page.getByRole("button", { name: "Full refund", exact: true }).click();
  const refund = page.getByRole("form", { name: "Full refund", exact: true });
  await refund.getByLabel("Refund reason", { exact: true }).fill("   ");
  await refund
    .getByRole("button", { name: "Confirm full refund", exact: true })
    .click();
  await expect(refund.getByRole("alert")).toContainText(
    "at least 3 characters",
  );
  await expect(refund.getByLabel("Refund reason", { exact: true })).toHaveValue(
    "   ",
  );
  for (const width of [390, 418]) {
    await page.setViewportSize({ width, height: 844 });
    await refund.getByLabel("Refund reason", { exact: true }).focus();
    const fits = await refund.evaluate((form) => {
      const field = form.querySelector("input")!.getBoundingClientRect();
      const area = form.closest(".table-wrap")!.getBoundingClientRect();
      return field.left - 6 >= area.left && field.right + 6 <= area.right;
    });
    expect(fits).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await refund
    .getByLabel("Refund reason", { exact: true })
    .fill("TEST return and restore stock");
  await refund
    .getByRole("button", { name: "Confirm full refund", exact: true })
    .click();
  await expect(page.getByText("Refunded", { exact: true })).toBeVisible();
  await closeShift(page);

  const firstPC = await a.owner
    .from("devices")
    .select("id")
    .eq("organization_id", a.organizationId)
    .eq("active", true)
    .single();
  expect(firstPC.error).toBeNull();
  await page.getByRole("button", { name: "Retire PC", exact: true }).click();
  await page
    .getByLabel("PC retirement reason", { exact: true })
    .fill("TEST replace this registered browser");
  await page
    .getByRole("button", { name: "Confirm PC retirement", exact: true })
    .click();
  await expect(page.getByText("Retired", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Checkout/ }).click();
  await page.getByRole("button", { name: "Open shift", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add Audit feeds", exact: true }),
  ).toBeEnabled();
  const nextPC = await a.owner
    .from("devices")
    .select("id")
    .eq("organization_id", a.organizationId)
    .eq("active", true)
    .single();
  expect(nextPC.error).toBeNull();
  expect(nextPC.data!.id).not.toBe(firstPC.data!.id);
  // A remote retirement (or an older app) can leave this browser holding a
  // retired identity. Recovery must preserve its saved receipts and its cart.
  await page.getByRole("button", { name: /^Checkout/ }).click();
  await page
    .getByRole("button", { name: "Add Audit feeds", exact: true })
    .click();
  await command(a.owner, "retire_device", {
    organizationId: a.organizationId,
    branchId: a.branchId,
    deviceId: nextPC.data!.id,
    reason: "TEST remote retirement with retained browser setup",
    countedCash: 0,
  });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  const retiredRows = page.locator("tr").filter({
    has: page.getByRole("button", {
      name: "Release retired setup",
      exact: true,
    }),
  });
  await expect(retiredRows).toHaveCount(2);
  await expect(
    retiredRows
      .last()
      .getByRole("button", { name: "Release retired setup", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: /^Checkout/ }).click();
  await expect(page.getByLabel("Quantity for Audit feeds")).toHaveValue("1");
  await page
    .getByRole("button", { name: "Remove Audit feeds", exact: true })
    .click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .locator(`tr[data-device-id="${firstPC.data!.id}"]`)
    .getByRole("button", { name: "Release retired setup", exact: true })
    .click();
  await expect(
    page.getByText(
      "This retired registration belongs to a different browser. Use the browser registered to it.",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .locator(`tr[data-device-id="${nextPC.data!.id}"]`)
    .getByRole("button", { name: "Release retired setup", exact: true })
    .click();
  await expect(
    page.getByText(
      "Retired setup released on this browser. Saved sales are retained. Open a shift to register its replacement.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Checkout/ }).click();
  await page.getByRole("button", { name: "Open shift", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add Audit feeds", exact: true }),
  ).toBeEnabled();
  const replacement = await a.owner
    .from("devices")
    .select("id")
    .eq("organization_id", a.organizationId)
    .eq("active", true)
    .single();
  expect(replacement.error).toBeNull();
  expect(replacement.data!.id).not.toBe(nextPC.data!.id);
  await page.getByRole("button", { name: /Sync center/ }).click();
  await expect(
    page.locator(".status-tag").filter({ hasText: /^synced$/ }),
  ).toHaveCount(1);

  await closeShift(page);

  await page
    .getByRole("combobox", { name: "Current branch", exact: true })
    .selectOption(a.branches[1].id);
  await page.getByRole("button", { name: "Purchasing", exact: true }).click();
  await page.getByLabel("Opening stock CSV", { exact: true }).setInputFiles({
    name: "test-opening.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "sku,unit,quantity,lot,expiresOn\nAUDIT-FEED,Kilo,20,,\n",
    ),
  });
  const opening = page.getByRole("form", {
    name: "Confirm opening stock",
    exact: true,
  });
  await expect(opening).toContainText("1 opening-stock lines");
  await opening.getByRole("checkbox").check();
  await opening
    .getByRole("button", { name: "Confirm opening stock import", exact: true })
    .click();
  await expect(opening).not.toBeVisible();
  await page.getByRole("button", { name: "Inventory", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Audit feeds" }),
  ).toContainText("20 kg");
  await page.getByRole("button", { name: "Stock counts", exact: true }).click();
  await page
    .getByLabel("Physical quantity in base units", { exact: true })
    .fill("19");
  await page
    .getByLabel("Count notes / reason", { exact: true })
    .fill("TEST verify approved discrepancy");
  await page
    .getByRole("button", { name: "Submit count for approval", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Approve adjustment", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "approved", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Inventory", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Audit feeds" }),
  ).toContainText("19 kg");
  await page.getByRole("button", { name: "Transfers", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Destination branch", exact: true })
    .selectOption(a.branchId);
  await page
    .getByLabel("Quantity in base units (kg / liter / piece)", { exact: true })
    .fill("1");
  await page
    .getByRole("button", { name: "Dispatch stock", exact: true })
    .click();
  await expect(page.getByText("in transit", { exact: true })).toBeVisible();
  await page
    .getByRole("combobox", { name: "Current branch", exact: true })
    .selectOption(a.branchId);
  await page
    .getByRole("button", { name: "Confirm receipt", exact: true })
    .click();
  await expect(page.getByText("received", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Inventory", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Audit feeds" }),
  ).toContainText("10001 kg");

  const b = await business("Other business product");
  await page.getByTitle("Sign out", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await login(page, b, "Other business product");
  await expect(
    page.getByRole("button", { name: "Add Audit feeds", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Transfers", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No transfers yet", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("branch history pages beyond 1000, filters Manila days, recovers a failed page and exports only loaded rows", async ({
  page,
  context,
}) => {
  test.setTimeout(240_000);
  const a = await business();
  const expected = new Set<string>();
  for (let start = 0; start < 1005; start += 25) {
    await Promise.all(
      Array.from({ length: Math.min(25, 1005 - start) }, async (_, index) => {
        const receiptId = randomUUID();
        expected.add(receiptId);
        await command(a.owner, "receive_stock", {
          organizationId: a.organizationId,
          branchId: a.branchId,
          receiptId,
          source: "purchase",
          reference: `TEST history ${start + index}`,
          items: [
            {
              productId: a.productId,
              unitId: a.unitId,
              quantity: "1",
              lot: "",
              expiresOn: null,
            },
          ],
        });
      }),
    );
  }
  const destination = a.branches[1].id as string;
  for (let i = 0; i < 55; i++) {
    await command(a.owner, "dispatch_transfer", {
      organizationId: a.organizationId,
      branchId: a.branchId,
      destinationBranchId: destination,
      transferId: randomUUID(),
      productId: a.productId,
      batchId: null,
      quantity: "1",
    });
    await command(a.owner, "submit_count", {
      organizationId: a.organizationId,
      branchId: a.branchId,
      countId: randomUUID(),
      productId: a.productId,
      batchId: null,
      counted: "10000",
      reason: "TEST report history fixture",
    });
  }
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const range = { from: today, to: today };
  async function collect(kind: HistoryKind, branchId = a.branchId) {
    const ids = new Set<string>();
    let before: HistoryCursor | undefined;
    do {
      const result = await historyPage(
        { kind, organizationId: a.organizationId, branchId, range, before },
        a.owner,
      );
      for (const row of result.rows) {
        expect(ids.has(String(row.id))).toBe(false);
        ids.add(String(row.id));
      }
      before = result.next;
    } while (before);
    return ids;
  }
  // The initial business fixture contributes one additional receiving record.
  const receipts = await collect("purchases");
  expect(receipts.size).toBe(1006);
  for (const id of expected) expect(receipts.has(id)).toBe(true);
  expect((await collect("transfers")).size).toBe(55);
  expect((await collect("transfers", destination)).size).toBe(55);
  expect((await collect("counts")).size).toBe(55);
  expect((await collect("audit")).size).toBeGreaterThan(1000);
  for (const kind of ["purchases", "transfers", "counts"] as const)
    expect((await collect(kind, a.branches[2].id as string)).size).toBe(0);
  expect(
    (
      await historyPage(
        {
          kind: "purchases",
          organizationId: a.organizationId,
          branchId: a.branchId,
          range: { from: "2099-01-01", to: "2099-01-01" },
        },
        a.owner,
      )
    ).rows,
  ).toEqual([]);
  const b = await business("Other business product");
  expect(
    (
      await historyPage(
        {
          kind: "purchases",
          organizationId: a.organizationId,
          branchId: a.branchId,
          range,
        },
        b.owner,
      )
    ).rows,
  ).toEqual([]);

  await page.goto("/");
  await login(page, a);
  await page.getByRole("button", { name: "Purchasing", exact: true }).click();
  const register = page.getByRole("region", {
    name: "Receiving history",
    exact: true,
  });
  await expect(register.locator("tbody tr")).toHaveCount(50);
  let failPage = true;
  await page.route("**/rest/v1/purchase_receipts?*", async (route) => {
    if (failPage) {
      await route.abort("failed");
    } else await route.continue();
  });
  await register
    .getByRole("button", { name: "Load older records", exact: true })
    .click();
  await expect(register.getByRole("alert")).toBeVisible();
  await expect(register.locator("tbody tr")).toHaveCount(50);
  failPage = false;
  await register
    .getByRole("button", { name: "Retry history", exact: true })
    .click();
  await expect(register.locator("tbody tr")).toHaveCount(100);
  const downloadPromise = page.waitForEvent("download");
  await register
    .getByRole("button", { name: "Export loaded rows (CSV)", exact: true })
    .click();
  const download = await downloadPromise;
  const csv = await readFile((await download.path())!, "utf8");
  expect(csv.split("\r\n")).toHaveLength(101);
  expect(csv).toContain('"Branch scope","ID","Reference"');
  expect(csv).toContain("TEST history");
  await context.setOffline(true);
  await expect(
    register.getByRole("button", { name: "Apply dates", exact: true }),
  ).toBeDisabled();
  await expect(register.locator("tbody tr")).toHaveCount(100);
  await context.setOffline(false);
  await expect(register.locator("tbody tr")).toHaveCount(50);
  await register.getByLabel("From date", { exact: true }).fill("2099-01-01");
  await register.getByLabel("Through date", { exact: true }).fill("2099-01-01");
  await register
    .getByRole("button", { name: "Apply dates", exact: true })
    .click();
  await expect(
    register.getByRole("heading", {
      name: "No records match these dates.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    register.getByRole("button", {
      name: "Export loaded rows (CSV)",
      exact: true,
    }),
  ).toBeDisabled();
  await register.getByLabel("From date", { exact: true }).fill("2099-01-02");
  await register
    .getByRole("button", { name: "Apply dates", exact: true })
    .click();
  await expect(register.getByRole("alert")).toContainText("end date");
  await expect(register.getByLabel("From date", { exact: true })).toHaveValue(
    "2099-01-02",
  );
  await register
    .getByRole("button", { name: "Clear dates", exact: true })
    .click();
  await expect(register.locator("tbody tr")).toHaveCount(50);
  for (const width of [1440, 390, 418]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(
      register.getByRole("button", { name: "Apply dates", exact: true }),
    ).toBeVisible();
    if (width === 390) {
      const scrollArea = register.getByRole("region", {
        name: "Receiving history records",
        exact: true,
      });
      await scrollArea.focus();
      const before = await scrollArea.evaluate((el) => el.scrollLeft);
      await scrollArea.press("ArrowRight");
      await expect
        .poll(() => scrollArea.evaluate((el) => el.scrollLeft))
        .toBeGreaterThan(before);
    }
  }
  await page
    .getByRole("combobox", { name: "Current branch", exact: true })
    .selectOption(a.branches[2].id as string);
  const empty = page.getByRole("region", {
    name: "Receiving history",
    exact: true,
  });
  await expect(
    empty.getByRole("heading", {
      name: "No receiving records yet",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    empty.getByRole("button", {
      name: "Export loaded rows (CSV)",
      exact: true,
    }),
  ).toBeDisabled();
});

test("receipt history crosses 1000 rows without losing equal-microsecond timestamps", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const a = await business();
  await page.goto("/");
  await login(page, a);
  await page.getByRole("button", { name: "Open shift", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add Audit feeds", exact: true }),
  ).toBeEnabled();
  const shift = await a.owner
    .from("cashier_shifts")
    .select("id,device_id,cashier_id")
    .eq("organization_id", a.organizationId)
    .is("closed_at", null)
    .single();
  expect(shift.error).toBeNull();
  const occurredAt = new Date().toISOString().replace(/\.\d{3}Z$/, ".123456Z");
  const expected = new Set<string>();
  for (let offset = 0; offset < 1005; offset += 25) {
    await Promise.all(
      Array.from({ length: Math.min(25, 1005 - offset) }, async () => {
        const transactionId = randomUUID();
        expected.add(transactionId);
        await command(a.owner, "record_sale", {
          version: 1,
          transactionId,
          organizationId: a.organizationId,
          branchId: a.branchId,
          deviceId: shift.data!.device_id,
          cashierId: shift.data!.cashier_id,
          shiftId: shift.data!.id,
          occurredAt,
          total: 100,
          cashReceived: 100,
          items: [
            {
              productId: a.productId,
              unitId: a.unitId,
              batchId: null,
              name: "Audit feeds",
              unitName: "Kilo",
              quantity: "1",
              factor: "1",
              unitPrice: 100,
              unitCost: 50,
              priceVersion: 1,
              lineTotal: 100,
            },
          ],
        });
      }),
    );
  }
  await page
    .getByRole("button", { name: "Sales & receipts", exact: true })
    .click();
  await expect(page.locator("tbody tr")).toHaveCount(50);
  await page
    .getByRole("button", { name: "Load older receipts", exact: true })
    .click();
  await expect(page.locator("tbody tr")).toHaveCount(100);
  const actual = new Set<string>();
  let before;
  do {
    const result = await salesPage(
      a.organizationId,
      a.branchId,
      before,
      a.owner,
    );
    for (const row of result.rows) {
      expect(actual.has(String(row.id))).toBe(false);
      actual.add(String(row.id));
    }
    before = result.next;
  } while (before);
  expect(actual).toEqual(expected);
  const wrongBranch = await salesPage(
    a.organizationId,
    a.branches[1].id,
    undefined,
    a.owner,
  );
  expect(wrongBranch.rows).toEqual([]);
});
