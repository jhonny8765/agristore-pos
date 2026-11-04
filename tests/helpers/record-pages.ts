import {expect,type Locator} from '@playwright/test';

export async function expectPagedRows(region:Locator,total:number){
 await expect(region).toContainText(new RegExp(`of ${total} loaded`));
 await expect(region.locator('tbody tr')).toHaveCount(Math.min(10,total));
}

export async function revealPagedRow(region:Locator,row:Locator){
 for(let page=0;page<100;page++){
  if(await row.count())return;
  const next=region.getByRole('button',{name:'Next',exact:true}).first();
  await expect(next).toBeEnabled();
  await next.click();
 }
 throw Error('The expected loaded record was not found within 100 display pages.');
}
