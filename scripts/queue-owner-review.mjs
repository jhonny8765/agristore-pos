// Generate a reviewable metadata-only transaction from the previously delivered review list.
// Usage: node scripts/queue-owner-review.mjs REPORT.md SOURCE-SNAPSHOT.json OUTPUT.sql
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const [reportPath,snapshotPath,outputPath]=process.argv.slice(2);
if(!reportPath||!snapshotPath||!outputPath)throw Error('Provide the review Markdown, source snapshot and output SQL paths.');
const report=await fs.readFile(reportPath,'utf8'),snapshot=JSON.parse((await fs.readFile(snapshotPath,'utf8')).replace(/^\uFEFF/,''));
const source=snapshot.rows[0].review,section=report.split('## Every product requiring a check')[1]?.split('\n## ')[0];
if(!section)throw Error('Complete product review section is missing.');
const rows=section.split('\n').filter(l=>l.startsWith('|')).map(l=>l.split('|').slice(1,-1).map(s=>s.trim())).filter(r=>r.length===7&&r[3].startsWith('₱'));
if(rows.length!==743||new Set(rows.map(r=>r[0])).size!==743)throw Error('Expected the complete 743-product review list without duplicates.');
const questions=rows.map(([code,name,categories,,,question])=>{
 const p=source.products.find(p=>p.code===code);
 if(!p||p.name!==name||p.units.length!==1)throw Error('Source identity needs manual review: '+code);
 return {id:p.id,code,name,questions:question.split(/(?<=\.) (?=[A-Z])/),categories:categories.split(', '),unitId:p.units[0].id,priceVersion:p.units[0].version,price:p.units[0].priceCentavos,cost:p.units[0].costCentavos};
});
const literal=v=>"'"+String(v).replaceAll("'","''")+"'";
const hash=createHash('sha256').update(report).digest('hex');
const sql=`begin;set local lock_timeout='5s';set local statement_timeout='30s';
-- Review questions only. No price, quantity, client or financial changes.
create temporary table review_queue_input on commit drop as select * from jsonb_to_recordset(${literal(JSON.stringify(questions))}::jsonb) as r(id uuid,code text,name text,questions jsonb,categories jsonb,"unitId" uuid,"priceVersion" integer,price bigint,cost bigint);
do $guard$begin
 if (select count(*) from review_queue_input)<>743 then raise exception 'Expected exactly 743 questions';end if;
 perform 1 from public.products p join review_queue_input r on r.id=p.id where p.organization_id='2a4ab966-5fd2-4037-93c7-b16b49f8ea71' order by p.id for update of p;
 if (select count(*) from review_queue_input r join public.products p on p.id=r.id and p.organization_id='2a4ab966-5fd2-4037-93c7-b16b49f8ea71' and p.active and p.original_code=r.code and p.name=r.name join public.product_units u on u.id=r."unitId" and u.product_id=p.id and u.organization_id=p.organization_id and u.price_version=r."priceVersion" join public.unit_prices v on v.organization_id=u.organization_id and v.unit_id=u.id and v.version=u.price_version and v.price=r.price and v.cost=r.cost)<>743 then raise exception 'Catalog changed since the review list. Refresh the evidence before queuing questions';end if;
 if exists(select 1 from public.products p join review_queue_input r on p.id=r.id where p.owner_review is not null and p.owner_review->>'sourceHash' is distinct from ${literal(hash)}) then raise exception 'Different owner questions already exist; do not overwrite progress';end if;
end$guard$;
with queued as(update public.products p set owner_review=jsonb_build_object('questions',r.questions,'categories',r.categories,'source','November 3 inventory / price review','sourceHash',${literal(hash)},'queuedAt',now()) from review_queue_input r where p.id=r.id and p.organization_id='2a4ab966-5fd2-4037-93c7-b16b49f8ea71' and p.owner_review is null returning p.id)
select count(*) as newly_queued from queued;
select count(*) as questions_saved from public.products p join review_queue_input r on p.id=r.id where p.owner_review->>'sourceHash'=${literal(hash)};
commit;`;
await fs.writeFile(outputPath,sql);console.log(JSON.stringify({products:questions.length,reportHash:hash,outputPath}));
