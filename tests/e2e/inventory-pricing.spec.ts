import {test, expect} from '@playwright/test';

test.use({bypassCSP:true,serviceWorkers:'block'});

test('owner inventory controls, stock worksheet and pricing fit the branch workflow',async ({page})=>{
  const org='95000000-0000-4000-8000-000000000001';
  const owner='95000000-0000-4000-8000-000000000011';
  const email='owner-preview@example.invalid';
  const auth={id:owner,aud:'authenticated',role:'authenticated',email};
  const offices=[{id:'magpet',name:'Magpet Branch'},{id:'antipas',name:'Antipas Branch'},{id:'arakan',name:'Arakan Branch'}];
  const sheet={revision:'42',rows:[
    {productId:'feed',batchId:'lot-1',name:'Farm Feed',sku:'000301',baseUnit:'kg',onHand:'5',batch:'LOT-1',expiry:'2030-01-01',countable:true},
    {productId:'seed',batchId:null,name:'Seed Pack',sku:'000302',baseUnit:'piece',onHand:'6',batch:null,expiry:null,countable:true},
  ]};
  let stockRequest:Record<string,unknown>|undefined;
  let copyRequest:Record<string,unknown>|undefined;
  let failPriceRead=true;
  let hiddenRows=[{id:'old',name:'Existing Hidden Item',sku:'000100',hiddenAt:'2026-11-23T03:00:00Z',
    reason:'Discontinued',hiddenRequestId:'hide-1'}];
  const products=[{id:'feed',name:'Farm Feed',sku:'000301',category:'Feeds',baseUnit:'kg',minimumStock:'0',active:true,
    tracksExpiry:false,units:[{id:'unit-1',name:'Sack',factor:'50',price:25000,cost:20000,priceVersion:1}],batches:[]}];
  await page.route('http://127.0.0.1:55321/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.startsWith('/auth/v1/token'))return route.fulfill({json:{access_token:'fake.test.token',token_type:'bearer',
      expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,refresh_token:'fake-refresh',user:auth}});
    if(path==='/auth/v1/user')return route.fulfill({json:auth});
    if(path.endsWith('/staff_memberships'))return route.fulfill({json:[{organization_id:org,branch_id:null,
      user_id:owner,role:'owner',name:'Preview owner',organizations:{name:'Preview store'}}]});
    if(path.endsWith('/branches'))return route.fulfill({json:offices.map((office,index)=>({...office,code:'B'+index}))});
    if(!path.includes('/rpc/'))return route.fulfill({json:[]});
    const {action,data}=route.request().postDataJSON();
    let result: unknown={};
    if(action==='snapshot')result={products,stocks:[{key:'feed:none',productId:'feed',batchId:null,quantity:sheet.rows[0].onHand}],
      confirmedIds:[],asOf:new Date().toISOString(),pricingMode:'branch'};
    if(action==='branch_stock')result={items:[],next:null,checkedAt:new Date().toISOString()};
    if(action==='stock_controls')result={openExceptions:0,exceptions:[],holds:[],issues:[]};
    if(action==='stock_followups')result={asOf:new Date().toISOString(),cases:[],next:null,expiry:[],expiryNext:null,staff:[],today:'2026-11-24',expiryTotals:{expired:0,today:0,soon:0,missing:0},totals:{open:0,dueToday:0,overdue:0,unassigned:0}};
    if(action==='shipment_obligations')result={incoming:[],outgoing:[],items:[]};
    if(action==='count_workspace')result={rows:[],openCount:0};
    if(action==='owner_stock_worksheet')result=sheet;
    if(action==='apply_owner_stock_count'){
      stockRequest=data;
      sheet.rows[0].onHand='0';
      result={id:data.requestId,duplicate:false,count:1,changed:1};
    }
    if(action==='hidden_products')result={rows:hiddenRows,total:hiddenRows.length,next:null};
    if(action==='restore_product'){
      expect(data).toMatchObject({productId:'old',hiddenRequestId:'hide-1',confirmed:true});
      hiddenRows=[];
      result={id:data.requestId,duplicate:false};
    }
    if(action==='product_review_state')result={stock:sheet.rows[0].onHand,revision:'42',asOf:new Date().toISOString(),shiftOpen:false};
    if(action==='branch_network')result={branches:offices,hubBranchId:'arakan',enabled:true,managed:true};
    if(action==='branch_price_book'){
      if(failPriceRead){
        failPriceRead=false;
        return route.fulfill({status:400,json:{message:'Price book temporarily unavailable'}});
      }
      const office=offices.find(branch=>branch.id===data.branchId);
      const ready=office?.id==='magpet'||office?.id==='arakan';
      result={pricingMode:'branch',networkEnabled:true,branchId:office?.id,branchName:office?.name,total:1,next:null,asOf:'2026-11-24',
        rows:[{unitId:'unit-1',productId:'feed',name:'Farm Feed',sku:'000301',unitName:'Sack',baseUnit:'kg',factor:'50',
          price:ready?25000:null,ready,version:ready?1:0,
          sellingPolicy:'fractional',branchPriceId:ready?'price-1':null,history:[]}]};
    }
    if(action==='preview_owner_price_copy') result={token:'draft-preview',count:1,added:1,replaced:0,skipped:0,
      rows:[{unitId:'unit-1',name:'Farm Feed',sku:'000301',unitName:'Sack',branchId:'antipas',branchName:'Antipas Branch',price:25000,currentPrice:null,decision:'add'}]};
    if(action==='apply_owner_price_copy'){
      copyRequest=data;
      result={id:data.requestId,count:1,duplicate:false};
    }
    if(action==='price_history')result={rows:[],total:0,next:null,asOf:'2026-11-24'};
    await route.fulfill({status:result ? 200 : 400,json:result ?? {message:'Unexpected test action'}});
  });
  page.setDefaultTimeout(10000);
  await page.goto('/');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password',{exact:true}).fill('fake-test-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  const nav=page.getByRole('navigation',{name:'Main navigation'});
  await expect(nav.getByRole('button',{name:'Credit',exact:true})).toBeVisible();
  await nav.getByRole('button',{name:'Inventory',exact:true}).click();
  await expect(page.locator('.branch-identity .branch-connection-dot')).toBeVisible();
  await expect(page.getByRole('combobox',{name:'Current branch',exact:true})).toHaveValue('magpet');

  await page.getByRole('tab',{name:'Hidden products',exact:true}).click();
  await expect(page.getByRole('button',{name:'Add product',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Edit product',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Restore Existing Hidden Item',exact:true}).click();
  await page.getByLabel('Reason for restoring').fill('Available from supplier again');
  await page.getByLabel('I checked this product and want it back in the catalog.').check();
  await page.getByRole('button',{name:'Restore product',exact:true}).click();
  await expect(page.getByText('Existing Hidden Item restored to the product list.')).toBeVisible();
  await page.getByRole('button',{name:'Edit product',exact:true}).click();
  await page.getByRole('searchbox',{name:'Find a product to edit'}).fill('000301');
  await page.getByRole('button',{name:'Farm Feed',exact:true}).click();
  await expect(page.getByRole('form',{name:'Edit details for Farm Feed'})).toBeVisible();
  await expect(page.getByRole('form',{name:'Review product setup'})).toContainText('Magpet Branch');
  await expect(page.getByRole('button',{name:'Hide this product',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Add product',exact:true}).click();
  await page.getByLabel('How customers buy this product').selectOption('sack');
  await page.getByLabel('Add Retail Price').check();
  await page.getByLabel('Retail selling unit name').fill('Loose kilo');
  await expect(page.getByLabel('Price per Loose kilo (₱)',{exact:true})).toBeVisible();
  await expect(page.getByLabel('Cost per Loose kilo (₱)',{exact:true})).toBeVisible();

  await page.getByRole('tab',{name:'Stock counts',exact:true}).click();
  await page.getByRole('button',{name:'Start Inventory',exact:true}).click();
  const sheetRegion=page.getByRole('region',{name:'Inventory worksheet items'});
  await expect(sheetRegion.getByRole('columnheader',{name:'Stock Bin'})).toBeVisible();
  await sheetRegion.getByLabel('Physical count for Farm Feed, batch LOT-1').fill('0');
  await page.getByRole('searchbox',{name:'Search count items'}).fill('000302');
  await expect(sheetRegion).toContainText('Seed Pack');
  await page.getByRole('button',{name:'Save (1)',exact:true}).click();
  expect(stockRequest).toBeUndefined();
  await page.getByLabel('Adjustment reason').fill('Annual count');
  await page.getByRole('button',{name:'Confirm and update On Hand'}).click();
  await expect(page.getByRole('status').filter({hasText:'Updated On Hand'})).toBeVisible();
  expect(stockRequest?.rows).toEqual([{productId:'feed',batchId:'lot-1',expected:'5',counted:'0'}]);
  await page.getByRole('searchbox',{name:'Search count items'}).fill('');
  await expect(sheetRegion.getByRole('row').filter({hasText:'Farm Feed'})).toContainText('0 kg');

  await page.getByRole('tab',{name:'Pricing',exact:true}).click();
  await expect(page.getByRole('alert').filter({hasText:'Price book temporarily unavailable'})).toBeVisible();
  await page.getByRole('button',{name:'Refresh selling prices',exact:true}).click();
  await expect(page.getByRole('columnheader',{name:'Antipas Branch',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Edit Farm Feed, Sack, Magpet Branch',exact:true}).click();
  const priceConfirmation=page.getByLabel('I confirm the branch, selling unit and price.');
  await priceConfirmation.check();
  await page.getByLabel('Selling price (₱)',{exact:true}).fill('255');
  await expect(priceConfirmation).not.toBeChecked();
  await priceConfirmation.check();
  await page.getByRole('combobox',{name:'Selling policy',exact:true}).selectOption('sealed_whole');
  await expect(priceConfirmation).not.toBeChecked();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.getByLabel('Select Farm Feed, Sack').check();
  await page.getByRole('button',{name:'Copy prices (1)',exact:true}).click();
  await expect(page.getByLabel('Copy prices from')).toHaveValue('arakan');
  await expect(page.getByLabel('Existing destination prices')).toHaveValue('missing');
  await page.getByLabel('Existing destination prices').selectOption('replace');
  await page.getByLabel('Antipas Branch',{exact:true}).check();
  await page.getByRole('button',{name:'Review price copy',exact:true}).click();
  await expect(page.getByRole('region',{name:'Price copy review'})).toContainText('Antipas Branch');
  expect(copyRequest).toBeUndefined();
  await page.getByLabel('Copy reason').fill('Align approved prices');
  await page.getByLabel('I reviewed the destination prices above.').check();
  await page.getByRole('button',{name:'Confirm price copy',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Copied 1 branch prices'})).toBeVisible();
  expect(copyRequest).toMatchObject({branchId:'arakan',scope:'selected',mode:'replace',destinations:['antipas'],unitIds:['unit-1']});
  await page.getByRole('button',{name:'Price history',exact:true}).click();
  await expect(page.getByRole('searchbox',{name:'Search price history'})).toBeVisible();

  for(const width of [1440,1024,390,320]){
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    if(width<=390){
      await expect(page.getByLabel('Compare branch')).toBeVisible();
      await page.getByLabel('Compare branch').selectOption('arakan');
      await expect(page.getByRole('columnheader',{name:'Arakan Branch',exact:true})).toBeVisible();
      await expect(page.getByRole('columnheader',{name:'Antipas Branch',exact:true})).toHaveCount(0);
    }
  }
  await page.context().setOffline(true);
  await expect(page.locator('.branch-connection.offline')).toBeVisible();
});
