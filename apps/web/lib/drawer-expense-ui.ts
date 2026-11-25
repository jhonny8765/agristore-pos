export function expensePesos(value:string,allowZero=false):number {
 if(!/^\d+(?:\.\d{1,2})?$/.test(value.trim()))throw Error('Enter a peso amount with up to two decimal places.');
 const [whole,fraction='']=value.trim().split('.'),amount=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
 if(amount<(allowZero?0n:1n)||amount>2147483647n)throw Error(`Enter an amount from ₱${allowZero?'0.00':'0.01'} to ₱21,474,836.47.`);return Number(amount);
}
export function drawerExpenseUnavailable(s:{practice:boolean;online:boolean;role:string;ownShift:boolean;pending:boolean}) {
 if(s.practice)return 'Daily expenses are unavailable in Practice. Use the signed-in store to record real drawer cash.';
 if(!['owner','cashier'].includes(s.role))return 'Only an owner or cashier can record drawer expenses.';
 if(!s.online)return 'Reconnect before recording. If cash was already paid, keep a paper note with the amount, payee, purpose, time and drawer. Do not pay again.';
 if(!s.ownShift)return 'Open or renew your own current shift on this PC before recording drawer cash.';
 if(s.pending)return 'Synchronize saved sales and confirm original requests in Sync center before recording another expense. Do not pay again.';
 return '';
}
export function expenseMoney(value:number|string){const n=BigInt(value),v=n<0n?-n:n;return `${n<0n?'-':''}₱${(v/100n).toLocaleString('en-PH')}.${String(v%100n).padStart(2,'0')}`;}
export function drawerExpenseConfirmation(result:Record<string,unknown>) {
 const label=`${String(result.number)} · ${expenseMoney(result.amount as number)}`;
 if(result.outcome==='committed_original')return `${label} · Existing ${result.resolution==='no_payment'?'no-payment decision':'record'} verified. No additional cash movement was recorded.`;
 if(result.resolution==='no_payment')return `${label} · No payment verified. No cash was added or deducted.`;
 if(result.outcome==='new_return'||result.kind==='return')return `${label} · Actual cash return recorded${result.cashDelta===0?' as historical evidence; current drawer unchanged':''}.`;
 if(result.kind==='metadata'||result.kind==='report')return `${label} · Correction recorded; no drawer cash moved.`;
 if(result.kind==='amount')return `${label} · Actual expense amount corrected in its open drawer.`;
 return `${label} · Expense recorded${result.cashDelta===0?' as historical evidence; current drawer unchanged':''}. Do not pay again.`;
}
