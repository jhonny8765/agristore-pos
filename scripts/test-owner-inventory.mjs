// Full local schema, synthetic accounts only; hosted business data is never used.
import {readFile} from 'node:fs/promises';
import {localPostgres} from './local-postgres.mjs';
const db=await localPostgres();
try{
 const result=await db.exec(await readFile('supabase/tests/database/owner-inventory.test.sql','utf8'));
 const lines=result.flatMap(r=>r.rows.flatMap(row=>Object.values(row))).filter(x=>typeof x==='string'&&/^(?:not )?ok \d+|^1\.\./.test(x));
 for(const line of lines)console.log(line);
 if(!lines.length||lines.some(x=>x.startsWith('not ok')))process.exitCode=1;
}catch(e){console.error(e.message,e.where??'');process.exitCode=1;}finally{await db.close();}
