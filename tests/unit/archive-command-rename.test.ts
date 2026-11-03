import {expect,it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {localPostgres} from '../../scripts/local-postgres.mjs';

it('reproduces and repairs the deployed archive parameter scope after the credit rename',async()=>{
 let reproduced=false;
 const db=await localPostgres({beforeMigration:async(database,file)=>{
  if(file==='20261103040000_customer_credit.sql'){
   const r=await database.query<{definition:string}>("select pg_get_functiondef('app_private.command(text,jsonb)'::regprocedure) definition");
   expect(r.rows[0].definition).toContain('jsonb_each_text(archive_request_data)');
   await database.exec(r.rows[0].definition.replace('jsonb_each_text(archive_request_data)','jsonb_each_text(command.data)'));
  }
  if(file==='20261103042000_archive_command_parameter_scope.sql'){
   await expect(database.query("select app_private.command_before_customer_credit('snapshot','{}')")).rejects.toMatchObject({code:'42P01',message:'missing FROM-clause entry for table "command"'});
   reproduced=true;
  }
 }});
 try{
  expect(reproduced).toBe(true);
  const setup=(await readFile('supabase/tests/database/customer-credit.test.sql','utf8')).split('set local role authenticated;select pg_temp.login(11);')[0];
  await db.exec(setup);await db.exec('set local role authenticated;select pg_temp.login(11);');
  for(const action of ['snapshot','dashboard','count_workspace','purchasing_workspace']){
   const result=await db.query<{result:unknown}>('select public.agri_command($1,pg_temp.ctx()) result',[action]);expect(result.rows[0].result).toBeTruthy();
  }
  await db.exec('reset role');
  const before=(await db.query('select (select count(*) from public.sales) sales,(select count(*) from public.payments) payments,(select count(*) from public.inventory_movements) movements')).rows;
  // The repair can be applied twice without changing the command or any ledger.
  await db.exec(await readFile('supabase/migrations/20261103042000_archive_command_parameter_scope.sql','utf8'));
  expect((await db.query('select (select count(*) from public.sales) sales,(select count(*) from public.payments) payments,(select count(*) from public.inventory_movements) movements')).rows).toEqual(before);
  await db.exec('rollback');
 }finally{await db.close();}
},30000);
