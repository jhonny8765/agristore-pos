import {test,expect,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

async function practice(page:Page){
 await page.goto('/');await page.getByRole('button',{name:'Try practice checkout',exact:true}).click();await page.getByRole('button',{name:'Add Grower feeds'}).click();
}
async function openPrint(page:Page){
 // Headless window.print has no physical dialog. Reproduce the browser events;
 // page.pdf below also exercises the browser's actual print-to-PDF renderer.
 await page.evaluate(()=>{window.print=()=>window.dispatchEvent(new Event('beforeprint'));});
 await page.getByRole('button',{name:'Print receipt',exact:true}).click();await page.emulateMedia({media:'print'});
 await expect(page.locator('body>.thermal-receipt')).toBeVisible();
}
async function checkPaper(page:Page,name:string){
 const paper=page.locator('body>.thermal-receipt');
 const width=(await paper.boundingBox())!.width;expect(width).toBeGreaterThan(181);expect(width).toBeLessThan(182);
 const overflow=await paper.evaluate(element=>{const box=element.getBoundingClientRect();return [...element.querySelectorAll<HTMLElement>('strong,span,dt,dd,p')].some(child=>{const rect=child.getBoundingClientRect();return rect.left<box.left-1||rect.right>box.right+1;});});expect(overflow).toBe(false);
 const forbidden=await page.locator('body button,body input,body select,.skip-link,.receipt-heading,.held-sale-control,.sidebar').evaluateAll(elements=>elements.filter(element=>element.getClientRects().length>0&&getComputedStyle(element).visibility!=='hidden').map(element=>element.textContent));expect(forbidden).toEqual([]);
 await paper.screenshot({path:`.impeccable/review/${name}.png`});
 const pdf=await page.pdf({path:`.impeccable/review/${name}.pdf`,preferCSSPageSize:true,displayHeaderFooter:false,printBackground:true});
 const source=pdf.toString('latin1');expect(source.match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
 const box=source.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)/);expect(box).not.toBeNull();expect(Math.abs(Number(box![1])-58*72/25.4)).toBeLessThan(1); // Chromium rounds PDF paper dimensions to its printer grid.
 // PDF rendering fires afterprint, so the document correctly leaves the screen.
 await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
}

test('58 mm checkout receipt prints only the saved sale with exact discounts and tender',async({page})=>{
 await mkdir('.impeccable/review',{recursive:true});await practice(page);await page.getByRole('button',{name:'Increase Grower feeds',exact:true}).click();await page.getByLabel('Discount (%) for Grower feeds',{exact:true}).fill('10');await page.getByRole('button',{name:'Add Urea 46-0-0'}).click();await page.getByLabel('Discount (%) for Urea 46-0-0',{exact:true}).fill('12.5');await page.getByLabel('Cash received',{exact:true}).fill('5000');await page.getByRole('button',{name:'Complete cash sale',exact:true}).click();await expect(page.getByRole('heading',{name:'Sale saved.',exact:true})).toBeVisible();await expect(page.locator('.thermal-receipt')).toHaveCount(0);
 await openPrint(page);const paper=page.locator('.thermal-receipt');await expect(paper.locator('.thermal-brand')).toHaveText('Better Yield');await expect(paper.locator('.thermal-practice')).toHaveText('PRACTICE ONLY · NO REAL SALE');await expect(paper.locator('.thermal-totals')).toContainText('₱4,810.00');await expect(paper.locator('.thermal-totals')).toContainText('−₱522.25');await expect(paper.locator('.thermal-total')).toContainText('₱4,287.75');await expect(paper.locator('.thermal-totals')).toContainText('₱5,000.00');await expect(paper.locator('.thermal-totals')).toContainText('₱712.25');await expect(paper.locator('.thermal-footer')).toContainText('Not a tax invoice.');await expect(paper.locator('.thermal-line')).toHaveCount(2);await checkPaper(page,'receipt-58mm-checkout');
 const id=await paper.getAttribute('data-receipt-id');await expect(paper.locator('.thermal-id')).toContainText(id!);await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));await page.emulateMedia({media:'screen'});await expect(page.locator('.thermal-receipt')).toHaveCount(0);await expect(page.getByRole('button',{name:'Print receipt',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Sales & receipts',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(1);await openPrint(page);await expect(page.locator('.thermal-title')).toContainText('COPY');await expect(page.locator('.thermal-receipt')).toHaveAttribute('data-receipt-id',id!);await expect(page.locator('.thermal-total')).toContainText('₱4,287.75');await checkPaper(page,'receipt-58mm-copy');
});

test('a long 58 mm receipt grows with its items and stays clear of the phone checkout',async({page})=>{
 await mkdir('.impeccable/review',{recursive:true});await practice(page);for(let n=1;n<24;n++)await page.getByRole('button',{name:'Add Grower feeds'}).click();await page.getByLabel('Cash received',{exact:true}).fill('40000');await page.getByRole('button',{name:'Complete cash sale',exact:true}).click();await expect(page.getByRole('heading',{name:'Sale saved.',exact:true})).toBeVisible();await page.setViewportSize({width:390,height:844});await openPrint(page);await expect(page.locator('.thermal-line')).toHaveCount(24);await expect(page.locator('.thermal-total')).toContainText('₱37,920.00');await checkPaper(page,'receipt-58mm-long');
});
