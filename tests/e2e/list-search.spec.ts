import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";

let bundle = "", styles = "";
test.beforeAll(async () => {
  const result = await build({ entryPoints: ["tests/fixtures/list-search.tsx"], bundle: true, write: false, format: "iife", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' }, plugins: [{ name: "isolated-count-fixture", setup(build) {
    build.onResolve({ filter: /\.\.\/lib\/(api|operations)$/ }, args => ({ path: args.path, namespace: "fixture" }));
    build.onResolve({filter:/^next\/image$/},()=>({path:'image',namespace:'fixture-image'}));
    build.onLoad({filter:/.*/,namespace:'fixture-image'},()=>({contents:'import {createElement} from "react";export default function Image({unoptimized,...props}){return createElement("img",props)}',loader:'js',resolveDir:process.cwd()}));
    build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: `export async function command(){return {rows:Array.from({length:23},(_,n)=>({id:'count-'+n,productId:'product-'+n,batchId:'lot-'+n,state:'first_count',startedBy:'other',reason:'Physical goods '+n,createdAt:'2026-11-03T00:00:00Z',expected:null,counted:null,recounted:null})),openCount:23}};export async function onlineOperation(db,actor,action,body){window.savedCount={action,body};}`, loader: "js" }));
  } }] });
  bundle = result.outputFiles[0].text;
  styles = (await readFile("apps/web/app/globals.css", "utf8")).replace('@import "tailwindcss";', "");
});
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  const links=await page.locator('link[rel="stylesheet"]').evaluateAll(nodes=>nodes.map(n=>(n as HTMLLinkElement).href));
  await page.route("**/__isolated-reference__",route=>route.fulfill({contentType:"text/html",body:`<html lang="en"><head><title>Isolated UI check</title>${links.map(href=>`<link rel="stylesheet" href="${href}">`).join('')}</head><body><div id="root"></div></body></html>`}));await page.goto("/__isolated-reference__");
  await page.addStyleTag({ content: styles.replace('@import "./reference-ui.css";', '') }); await page.addScriptTag({ content: bundle });
});

test("saved lists stay at ten, can page in both directions and clamp after refresh", async ({ page }) => {
  const area = page.getByRole("region", { name: "Receipt fixture" }), pager = area.getByRole("navigation").first();
  await expect(area.locator("tbody tr")).toHaveCount(10);
  await pager.getByRole("button", { name: "Next", exact: true }).click();
  await expect(area.locator("tbody tr").first()).toContainText("Receipt 11");
  await pager.getByRole("button", { name: "Last loaded" }).click();
  await expect(area.locator("tbody tr")).toHaveCount(3);
  await expect(pager).toContainText("21–23 of 23 loaded");
  await expect(area).toContainText("All receipts total: 80500 centavos");
  await area.getByRole("button", { name: "Load another page" }).click();
  await expect(area.locator("tbody tr")).toHaveCount(10);
  await pager.getByRole("button", { name: "Next", exact: true }).click();
  await expect(area.locator("tbody tr").first()).toContainText("Receipt 31");
  await area.getByRole("button", { name: "Refresh with four records" }).click();
  await expect(area.locator("tbody tr")).toHaveCount(4); await expect(area.getByRole("navigation")).toHaveCount(1); await expect(area.getByRole("navigation")).toContainText("1–4 of 4 loaded"); await expect(area.getByRole("navigation")).toContainText("Page 1 of 1");
});

test("blind counts find name, code and batch without revealing expected stock", async ({ page }) => {
  const area = page.getByRole("region", { name: "Blind stock counts", exact: true }), form = page.getByRole("form", { name: "Start a blind count" });
  await expect(area.locator(".count-record")).toHaveCount(1);
  await expect(area.getByRole("region",{name:"Count worklist",exact:true}).locator("tbody tr")).toHaveCount(10);
  await area.getByRole("button",{name:"Start blind count: open new form",exact:true}).click();
  const field = form.getByRole("combobox", { name: "Product / batch", exact: true });
  await field.fill("grower"); await expect(form.getByRole("option")).toHaveCount(10);
  await expect(form).toContainText("120 matches");
  await field.fill("SHOP-119"); await expect(form.getByRole("option")).toHaveText("Grower blend 119 · LOT-119 (kg)");
  await field.press("ArrowDown"); await field.press("Enter");
  await expect(form.locator('input[name="stock"]')).toHaveValue("product-119:lot-119");
  await form.getByLabel("Counting scope / reason").fill("Physical count only");
  await form.getByRole("button", { name: "Start blind count", exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { savedCount: { body: unknown } }).savedCount.body)).toMatchObject({ productId: "product-119", batchId: "lot-119", reason: "Physical count only" });
  await area.getByRole("button",{name:"Start blind count: open new form",exact:true}).click();
  await expect(field).toHaveValue("");
  await field.fill("LOT-87"); await expect(form.getByRole("option")).toHaveCount(1);
  await expect(area).not.toContainText("123456789"); await expect(area.locator(".count-comparison")).toHaveCount(0);
  await field.fill("no such feed"); await expect(form).toContainText("No matches.");
  expect(await field.evaluate(node => (node as HTMLInputElement).checkValidity())).toBe(false);
});

test("typing clears a prior unit selection and keyboard dismissal stays safe", async ({ page }) => {
  const form = page.getByRole("form", { name: "Controlled unit picker" }), field = form.getByRole("combobox");
  await field.fill("FEED-119"); await form.getByRole("option").click();
  await expect(form.locator('input[name="unit"]')).toHaveValue("unit-119");
  await field.fill("unmatched"); await expect(form.locator('input[name="unit"]')).toHaveValue("");
  await field.press("Escape"); await expect(field).toHaveAttribute("aria-expanded", "false");
  expect(await field.evaluate(node => (node as HTMLInputElement).checkValidity())).toBe(false);
  await field.fill("FEED-118"); await field.press("ArrowDown"); await field.press("Enter");
  await form.getByRole("button", { name: "Reset unit" }).click(); await expect(field).toHaveValue("");
  const supplier = page.getByRole("combobox", {name:"Optional supplier",exact:true});
  expect(await supplier.evaluate(node => (node as HTMLInputElement).checkValidity())).toBe(true);
  await supplier.fill("Agri"); expect(await supplier.evaluate(node => (node as HTMLInputElement).checkValidity())).toBe(false);
  await page.getByRole("option", {name:"Agri supply",exact:true}).click();
  await expect(page.getByRole("form", {name:"Optional supplier picker"}).locator('input[name="supplier"]')).toHaveValue("supplier-1");
});

test("search suggestions and page controls fit desktop and mobile accessibly", async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    if(!await page.getByRole("combobox", {name:"Product / batch",exact:true}).isVisible())await page.getByRole("button",{name:"Start blind count: open new form",exact:true}).click();
    await page.getByRole("combobox", { name: "Product / batch", exact: true }).fill("grower");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const scan = await new AxeBuilder({ page }).analyze(); expect(scan.violations).toEqual([]);
    await page.screenshot({ path: `.impeccable/review/lists-search-${width}.png`, fullPage: true });
  }
});
