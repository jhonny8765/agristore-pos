import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Product } from "@agristore/domain";
import { InventoryWorkspace } from "../../apps/web/components/inventory-workspace";

const product = {
  id: "product-1",
  active: true,
  name: "Test Feed",
  sku: "TEST-FEED",
  category: "Feeds",
  baseUnit: "kg",
  minimumStock: "5",
  setupPending: false,
  pricePending: false,
  batches: [],
  units: [{ id: "unit-1", name: "Sack", factor: "50", price: 180000, cost: 150000, priceVersion: 1 }],
} as unknown as Product;
const handlers = {
  onControls: vi.fn(),
  onExpiry: vi.fn(),
  onAdd: vi.fn(),
  onReceive: vi.fn(),
  onEdit: vi.fn(),
  onCount: vi.fn(),
  onEditCatalog: vi.fn(),
  onReview: vi.fn(),
  onPrices: vi.fn(),
};
function render(canManage: boolean) {
  return renderToStaticMarkup(createElement(InventoryWorkspace, {
    products: [product], stock: new Map<string,string>(), canManage, ...handlers,
  }));
}

describe("owner inventory shortcuts", () => {
  it("shows add, receive and per-product edit actions only to owners", () => {
    const owner = render(true);
    expect(owner).toContain("Manage inventory");
    expect(owner).toContain("Add product");
    expect(owner).toContain("Add stock");
    expect(owner).toContain("Edit product");
    expect(owner).toContain("Add received stock for Test Feed");
    expect(owner).toContain("Start stock count for Test Feed");
    expect(owner).toContain("Open Test Feed details and prices");
    expect(owner).toContain("Edit details and prices for Test Feed");
    const staff = render(false);
    expect(staff).not.toContain("owner-inventory-toolbar");
    expect(staff).not.toContain("Add received stock for Test Feed");
    expect(staff).not.toContain("Start stock count for Test Feed");
    expect(staff).not.toContain("Open Test Feed details and prices");
    expect(staff).not.toContain("Edit details and prices for Test Feed");
  });
  it("keeps product identity, price, stock and status visible", () => {
    const markup = render(true);
    expect(markup).toContain("Test Feed");
    expect(markup).toContain("TEST-FEED");
    expect(markup).toContain("On hand");
    expect(markup).toContain("Status");
  });
});
