import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {test,expect} from '@playwright/test';
import {countCommand,testCountStaff} from './blind-count-fixtures';
import type {CreditBook} from '@agristore/domain';
const dueOn=(days:number)=>{const date=new Date(new Date(Date.now()+8*3600000).toISOString().slice(0,10)+'T00:00:00Z');date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10);};

test('genuine signed-in credit sale, racing retries, collections and role boundaries',async({page})=>{
 if(process.env.AGRISTORE_LOCAL_INTEGRATION!=='1'||process.env.NEXT_PUBLIC_SUPABASE_URL!=='http://127.0.0.1:55321')throw Error('Disposable loopback credit fixtures only');
 const owner=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}}),email=`credit-${randomUUID()}@example.invalid`,password=`TEST-${randomUUID()}!`;
 const signup=await owner.auth.signUp({email,password});expect(signup.error).toBeNull();
 const {organizationId}=await countCommand<{organizationId:string}>(owner,'bootstrap',{name:'TEST credit',ownerName:'TEST owner'});
 const branches=await owner.from('branches').select('id').eq('organization_id',organizationId).order('code');expect(branches.error).toBeNull();const branchId=branches.data![0].id as string,ctx={organizationId,branchId};
 const {id:productId}=await countCommand<{id:string}>(owner,'create_product',{...ctx,name:'TEST credit seeds',sku:'TEST-CREDIT',category:'Seeds',baseUnit:'piece',minimumStock:'0',units:[{name:'Packet',factor:'1',price:10000,cost:5000}]});
 const unit=await owner.from('product_units').select('id').eq('product_id',productId).single();expect(unit.error).toBeNull();const unitId=unit.data!.id as string;
 await countCommand(owner,'receive_stock',{...ctx,receiptId:randomUUID(),source:'purchase',reference:'TEST goods',items:[{productId,unitId,quantity:'20'}]});
 const clientId=randomUUID();await countCommand(owner,'save_credit_client',{...ctx,clientId,requestId:randomUUID(),name:'TEST credit farmer',enabled:true,limit:500000,terms:[30,60,90],expectedVersion:0,approved:true,reason:'TEST owner approval'});
 const deviceId=randomUUID();await countCommand(owner,'register_device',{...ctx,deviceId,name:'TEST credit drawer'});const {shiftId}=await countCommand<{shiftId:string}>(owner,'open_shift',{...ctx,deviceId,openingCash:10000});
 const requestId=randomUUID(),sale={...ctx,requestId,version:2,clientId,term:60,expectedDueOn:dueOn(60),officialReference:'TEST-CREDIT-001',manualInvoiceConfirmed:true,cashierId:signup.data.user!.id,deviceId,shiftId,total:100000,cashReceived:20000,items:[{productId,unitId,batchId:null,name:'TEST credit seeds',unitName:'Packet',quantity:'10',factor:'1',unitPrice:10000,unitCost:5000,priceVersion:1,lineTotal:100000}]};
 const same=await Promise.all([countCommand(owner,'record_credit_sale',sale),countCommand(owner,'record_credit_sale',sale)]);expect(same.filter(r=>r.duplicate)).toHaveLength(1);
 let book=await countCommand<CreditBook>(owner,'credit_book',ctx);expect(book.outstanding).toBe(80000);expect(book.invoices[0].dueOn).toBe(sale.expectedDueOn);
 const collection={...ctx,requestId:randomUUID(),saleId:requestId,shiftId,amount:50000,reference:'TEST cash received',reason:'TEST counted cash'};
 const competing=await Promise.all([collection,{...collection,requestId:randomUUID()}].map(data=>owner.rpc('agri_command',{action:'collect_credit_payment',data})));expect(competing.filter(r=>!r.error)).toHaveLength(1);expect(competing.filter(r=>r.error?.message.includes('current unpaid balance'))).toHaveLength(1);
 book=await countCommand<CreditBook>(owner,'credit_book',ctx);expect(book.outstanding).toBe(30000);
 await countCommand(owner,'save_credit_client',{...ctx,clientId,requestId:randomUUID(),name:'TEST credit farmer',enabled:true,limit:100000,terms:[30,60,90],expectedVersion:1,approved:true,reason:'TEST owner reviewed concurrent limit'});
 const limitRace=await Promise.all([0,1].map(n=>owner.rpc('agri_command',{action:'record_credit_sale',data:{...sale,requestId:randomUUID(),term:30,expectedDueOn:dueOn(30),officialReference:`TEST-CREDIT-RACE-${n}`,total:40000,cashReceived:0,items:[{...sale.items[0],quantity:'4',lineTotal:40000}]}})));expect(limitRace.filter(r=>!r.error)).toHaveLength(1);expect(limitRace.filter(r=>r.error?.message.toLowerCase().includes('limit'))).toHaveLength(1);
 expect((await countCommand<CreditBook>(owner,'credit_book',ctx)).outstanding).toBe(70000);
 const inventory=await owner.from('branch_inventory').select('quantity').eq('branch_id',branchId).eq('product_id',productId).single();expect(inventory.error).toBeNull();expect(Number(inventory.data!.quantity)).toBe(6);
 const staff=await testCountStaff({owner,organizationId,branchId});const denied=await staff.owner.rpc('agri_command',{action:'credit_book',data:ctx});expect(denied.error?.code).toBe('42501');
 for(const table of ['credit_clients','credit_invoices','credit_entries','credit_due_history']){const direct=await owner.from(table).select('*');expect(direct.error?.code).toBe('42501');}
 await page.goto('/');await page.getByLabel('Email address',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('button',{name:'Clients & credit',exact:true}).click();await expect(page.getByRole('button',{name:'TEST credit farmer',exact:true})).toBeVisible();await expect(page.locator('.credit-workspace')).toContainText('₱700.00');
 await countCommand(owner,'close_shift',{...ctx,shiftId,countedCash:80000});
});
