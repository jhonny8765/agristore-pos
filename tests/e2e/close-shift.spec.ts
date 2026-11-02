import {expect,test} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('cashier can find closing, resolve a basket and retain a counted draft without making a sale',async({page,context})=>{
 await page.goto('/');await page.getByRole('button',{name:'Try practice checkout',exact:true}).click();
 await expect(page.getByRole('button',{name:'Close shift',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Add Grower feeds'}).click();
 await page.getByRole('button',{name:'Close shift',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Close shift',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Close shift',exact:true})).toBeDisabled();
 await page.getByLabel('Cash counted in drawer (₱)',{exact:true}).fill('123.45');
 await page.getByRole('button',{name:'Return to basket',exact:true}).click();
 await expect(page.getByLabel(/^Quantity \(.+\) for Grower feeds$/)).toHaveValue('1');
 await page.getByRole('button',{name:'Close shift',exact:true}).click();
 await expect(page.getByLabel('Cash counted in drawer (₱)',{exact:true})).toHaveValue('123.45');
 await context.setOffline(true);
 await expect(page.getByText('Reconnect to the internet to close. Your shift and saved sales stay on this PC.',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Close shift',exact:true})).toBeDisabled();
 await context.setOffline(false);
 await page.getByRole('button',{name:'Keep shift open',exact:true}).click();
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Count cash & close shift',exact:true}).click();
 await expect(page.getByLabel('Cash counted in drawer (₱)',{exact:true})).toHaveValue('123.45');
});

test('closing stays labelled, accessible and contained on desktop and mobile',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Try practice checkout',exact:true}).click();
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});
  const shortcut=page.getByRole('button',{name:'Close shift',exact:true});
  await expect(shortcut).toBeVisible();
  expect(await shortcut.evaluate(el=>getComputedStyle(el).fontSize)).not.toBe('0px');
  await shortcut.click();
  await expect(page.getByLabel('Cash counted in drawer (₱)',{exact:true})).toHaveValue('');
  await expect(page.getByRole('button',{name:'Close shift',exact:true})).toBeDisabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const scan=await new AxeBuilder({page}).include('.close-shift-panel').analyze();expect(scan.violations).toEqual([]);
  await page.screenshot({path:`.impeccable/review/close-shift-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:'Keep shift open',exact:true}).click();
 }
});
