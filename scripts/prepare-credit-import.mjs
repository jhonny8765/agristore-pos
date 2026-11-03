// Converts a private, read-only XLS extraction into a reviewable maintenance import.
// This script never contacts the database; generated business data stays outside source control.
import fs from 'node:fs/promises';
const [inputFile,organizationId,branchId,ownerId,outputFile]=process.argv.slice(2);
if(!inputFile||!outputFile||![organizationId,branchId,ownerId].every(v=>/^[0-9a-f-]{36}$/i.test(v??'')))throw Error('Pass extracted JSON, organization, branch, owner and private output SQL path.');
const input=JSON.parse(await fs.readFile(inputFile,'utf8'));
if(!/^[0-9a-f]{64}$/.test(input.sha256)||input.sheets.length!==1||input.sheets[0].sheet!=='CREDIT')throw Error('Use the verified CREDIT workbook extraction.');
const headers=input.sheets[0].rows[0].cells.map(c=>c.value);
if(JSON.stringify(headers)!==JSON.stringify(['Date','Type','Reference No','Name','Location','Sales Rep','Group','Notes','Amount']))throw Error('Source columns changed. Review the workbook before importing.');
const rows=input.sheets[0].rows.slice(1).map(row=>{
 const c=Object.fromEntries(row.cells.map(c=>[c.column,c.value]));
 if(c[2]!=='Invoice'||c[5]!=='DISTRIBUTION - MAGPET'||!['CUSTOMER','BRANCH'].includes(c[7])||!/^\d{4}-\d{2}-\d{2}T/.test(c[1])||typeof c[9]!=='number')throw Error(`Source row ${row.row} needs review.`);
 const cents=Math.round(c[9]*100);if(!Number.isSafeInteger(cents)||cents<0||Math.abs(c[9]*100-cents)>1e-5)throw Error(`Invalid source amount at row ${row.row}.`);
 return {sourceRow:row.row,issuedOn:c[1].slice(0,10),reference:String(c[3]).trim(),name:String(c[4]).trim(),location:c[5],salesRep:c[6]??'',group:c[7],notes:c[8]??'',amountCentavos:cents};
});
const tag='$credit_'+input.sha256.slice(0,12)+'$';const body=JSON.stringify(rows);
if(body.includes(tag))throw Error('Choose a different SQL quote delimiter.');
const customer=rows.filter(r=>r.group==='CUSTOMER'),summary={sha256:input.sha256,rows:rows.length,clients:new Set(customer.map(r=>r.name.toUpperCase().replace(/\s+/g,' '))).size,invoices:customer.filter(r=>r.amountCentavos>0).length,balanceCentavos:customer.reduce((n,r)=>n+r.amountCentavos,0),excludedBranchRows:rows.filter(r=>r.group==='BRANCH').length,zeroBalanceRows:customer.filter(r=>r.amountCentavos===0).length};
const sql=`begin;\nselect app_private.import_opening_credit('${organizationId}','${branchId}','${ownerId}','${input.sha256}',${tag}${body}${tag}::jsonb) as imported;\ncommit;\n`;
await fs.writeFile(outputFile,sql);await fs.writeFile(outputFile.replace(/\.sql$/,'.summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary));
