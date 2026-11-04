import { test, expect } from '@playwright/test';

test('phone checkout offers labeled navigation, comfortable controls and urgent owner work', async ({ page }) => {
 await page.goto('/'); await page.getByRole('button', { name: 'Try practice checkout' }).click();
 const feed = page.locator('.product').filter({has:page.getByRole('heading',{name:'Grower feeds',exact:true})});
 await expect(feed.locator('.add-product')).toContainText('Add Sack (50 kg)');
 await expect(feed.getByRole('button',{name:'Sell Grower feeds by weight',exact:true})).toBeVisible();
 await expect(feed.getByRole('button',{name:'Sell Grower feeds by peso amount',exact:true})).toBeVisible();
 await feed.locator('.add-product').click();
 for(const width of [390,320]) {
  await page.setViewportSize({width,height:900});await page.getByRole('link',{name:'Review sale',exact:true}).click();
  for(const selector of ['.receipt-item-top>button','.receipt-item-config select','.cash-shortcuts button','.quantity-control button','.line-discount input']) {
   const sizes=await page.locator(selector).evaluateAll(nodes=>nodes.filter(n=>n.getBoundingClientRect().width>0).map(n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height})));
   expect(sizes.length).toBeGreaterThan(0);for(const size of sizes){expect(size.height).toBeGreaterThanOrEqual(44);expect(size.width).toBeGreaterThanOrEqual(44);}
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 await page.getByRole('button',{name:'Menu',exact:true}).click();await expect(page.getByRole('button',{name:'Close menu',exact:true})).toHaveAttribute('aria-expanded','true');
 await expect(page.locator('.navigation-open .nav-item').first()).toHaveCSS('font-size','17px');
 await page.getByRole('button',{name:'Close menu',exact:true}).press('Escape');await expect(page.getByRole('button',{name:'Menu',exact:true})).toBeFocused();
 await page.getByRole('button',{name:'Menu',exact:true}).click();await page.locator('.sidebar-bottom').getByRole('button',{name:'Settings',exact:true}).focus();await page.keyboard.press('Tab');await expect(page.locator('.navigation-backdrop')).toHaveCount(0);
 await page.getByRole('button',{name:'Menu',exact:true}).click();await page.getByRole('button',{name:'Overview',exact:true}).click();await expect(page.getByRole('button',{name:'Menu',exact:true})).toHaveAttribute('aria-expanded','false');await page.evaluate(()=>scrollTo(0,0));
 const attention=page.locator('.dashboard-attention');await expect(attention).toBeInViewport();expect(await attention.evaluate(n=>n.getBoundingClientRect().top)).toBeLessThan(await page.locator('.workspace-stats').first().evaluate(n=>n.getBoundingClientRect().top));
 await page.screenshot({path:'.impeccable/review/usability-phone-overview.png',fullPage:true});
});
