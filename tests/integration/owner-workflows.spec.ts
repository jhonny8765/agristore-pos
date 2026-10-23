import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { salesPage } from "../../apps/web/lib/api";

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
async function business(productName = "Audit feeds") {
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
      units: [{ name: "Kilo", factor: "1", price: 100, cost: 50 }],
    },
  );
  const unit = await owner
    .from("product_units")
    .select("id")
    .eq("product_id", productId)
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
  await closeShift(page);

  await page
    .getByRole("combobox", { name: "Current branch", exact: true })
    .selectOption(a.branches[1].id);
  await page.getByRole("button", { name: "Purchasing", exact: true }).click();
  await page
    .getByLabel("Opening stock CSV", { exact: true })
    .setInputFiles({
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
