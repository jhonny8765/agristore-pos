/** Monetary values are integer centavos. Never pass pesos through Number first. */
export type Centavos=number|string|bigint;
export function exactCentavos(value:Centavos):bigint{
 if(typeof value==='number'){if(!Number.isSafeInteger(value))throw Error('Money must use exact integer centavos.');return BigInt(value);}
 if(typeof value==='bigint')return value;
 if(!/^-?\d+$/.test(value))throw Error('Money must use exact integer centavos.');return BigInt(value);
}
export function moneyInput(value:Centavos):string{const n=exactCentavos(value),absolute=n<0n?-n:n;return `${n<0n?'-':''}${absolute/100n}.${String(absolute%100n).padStart(2,'0')}`;}
export function money(value:Centavos):string{const n=exactCentavos(value),absolute=n<0n?-n:n;return `${n<0n?'-':''}₱${new Intl.NumberFormat('en-PH').format(absolute/100n)}.${String(absolute%100n).padStart(2,'0')}`;}
export function moneyCentavos(pesos:string):number{
 const text=pesos.trim();if(!/^(?:\d{1,14}(?:\.\d{1,2})?|\.\d{1,2})$/.test(text))throw Error('Enter a non-negative peso amount with up to two decimal places.');
 const [whole='',fraction='']=text.split('.'),value=BigInt(whole||'0')*100n+BigInt(fraction.padEnd(2,'0'));
 if(value>BigInt(Number.MAX_SAFE_INTEGER))throw Error('The amount exceeds the supported exact money range.');return Number(value);
}
export function cashQuickAmounts(total:number):number[]{const value=exactCentavos(total);if(value<0n)throw Error('Sale total cannot be negative.');return [...new Set([value,...[10000n,50000n].map(step=>(value+step-1n)/step*step)])].filter(n=>n>0n&&n<=BigInt(Number.MAX_SAFE_INTEGER)).map(Number);}
