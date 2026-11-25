import { z } from "zod";

const day = z.iso.date();
const amount = z.string().regex(/^-?\d+$/);
const id = z.uuid();
const row = z.object({
  branchId:id, bucket:z.string().regex(/^\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):00:00)?$/),
  gross:amount, refunds:amount.nullable(), cost:amount.nullable(), expenses:amount,
  notebook:z.boolean(), overlap:z.boolean(),
});
const financialReport = z.object({
  asOf:z.iso.datetime({offset:true}), from:day, through:day, grain:z.enum(["day","hour"]),
  branches:z.array(z.object({id,name:z.string().min(1)})), rows:z.array(row),
});

export type FinancialRow = z.infer<typeof row>;
export type FinancialReport = z.infer<typeof financialReport>;
export type FinancialRange = {from:string;through:string};
export type FinancialPreset = "today"|"yesterday"|"seven"|"month";
export type FinancialGrain = "hour"|"day"|"week"|"month";

const manilaDate = new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"});
export const financialToday = (now = new Date()) => manilaDate.format(now);

const asDate = (value:string) => new Date(value+"T00:00:00Z");
function addDays(value:string,days:number) {
  const date=asDate(value);
  date.setUTCDate(date.getUTCDate()+days);
  return date.toISOString().slice(0,10);
}

export function financialPeriod(preset:FinancialPreset, now=new Date()):FinancialRange {
  const today=financialToday(now);
  if(preset==="yesterday"){const date=addDays(today,-1);return {from:date,through:date};}
  return {from:preset==="seven"?addDays(today,-6):preset==="month"?today.slice(0,7)+"-01":today,through:today};
}

export function validFinancialRange(range:FinancialRange,today:string) {
  return day.safeParse(range.from).success && day.safeParse(range.through).success &&
    range.from<=range.through && range.through<=today &&
    +asDate(range.through)-+asDate(range.from)<=365*86400000;
}

export function readFinancialReport(value:unknown,range:FinancialRange,branchId:string|null,grain:"day"|"hour"):FinancialReport {
  const report=financialReport.parse(value);
  const allowed=new Set(report.branches.map(branch=>branch.id));
  const seen=new Set<string>();
  if(report.from!==range.from||report.through!==range.through||report.grain!==grain||
    !allowed.size||allowed.size!==report.branches.length||branchId&&(allowed.size!==1||!allowed.has(branchId))) throw Error("The report scope could not be verified.");
  for(const entry of report.rows) {
    const date=entry.bucket.slice(0,10),key=entry.branchId+" "+entry.bucket;
    if(!allowed.has(entry.branchId)||seen.has(key)||date<range.from||date>range.through||
      (grain==="hour"?entry.bucket.length!==19:entry.bucket.length!==10)) throw Error("The report contains an invalid period.");
    seen.add(key);
  }
  return report;
}

export function summarizeFinancialRows(rows:FinancialRow[]) {
  let gross=0n,refunds:bigint|null=0n,cost:bigint|null=0n,expenses=0n,notebook=false,overlap=false;
  for(const row of rows) {
    gross+=BigInt(row.gross);
    expenses+=BigInt(row.expenses);
    refunds=refunds===null||row.refunds===null?null:refunds+BigInt(row.refunds);
    cost=cost===null||row.cost===null?null:cost+BigInt(row.cost);
    notebook ||= row.notebook;
    overlap ||= row.overlap;
  }
  const net=refunds===null?null:gross-refunds;
  const grossProfit=net===null||cost===null?null:net-cost;
  return {gross:String(gross),refunds:refunds?.toString()??null,cost:cost?.toString()??null,expenses:String(expenses),
    net:net?.toString()??null,grossProfit:grossProfit?.toString()??null,profit:grossProfit===null?null:String(grossProfit-expenses),notebook,overlap};
}

function calendarBucket(date:string,grain:FinancialGrain) {
  if(grain==="month")return date.slice(0,7)+"-01";
  if(grain==="week")return addDays(date,-((asDate(date).getUTCDay()+6)%7));
  return date;
}

export function groupFinancialRows(rows:FinancialRow[],range:FinancialRange,grain:FinancialGrain) {
  const groups=new Map<string,FinancialRow[]>();
  for(const row of rows) {
    const key=calendarBucket(grain==="hour"?row.bucket:row.bucket.slice(0,10),grain);
    const group=groups.get(key);
    if(group)group.push(row);
    else groups.set(key,[row]);
  }
  if(grain==="hour") return Array.from({length:24},(_,hour)=>{
    const from=range.from+"T"+String(hour).padStart(2,"0")+":00:00";
    return {from,through:from,...summarizeFinancialRows(groups.get(from)??[])};
  });
  const dates=new Map<string,{from:string;through:string}>();
  for(let date=range.from;date<=range.through;date=addDays(date,1)) {
    const key=calendarBucket(date,grain),bucket=dates.get(key);
    if(bucket)bucket.through=date;
    else dates.set(key,{from:date,through:date});
  }
  return Array.from(dates,([key,dates])=>({...dates,...summarizeFinancialRows(groups.get(key)??[])}));
}

export type FinancialBucket = ReturnType<typeof groupFinancialRows>[number];
