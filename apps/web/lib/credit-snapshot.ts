import type {CreditBook} from '@agristore/domain';

/** A fresh page may replace its predecessor only when their full read models agree. */
export function mergeCreditPage(previous:CreditBook,next:CreditBook):CreditBook {
 if(!previous.snapshotRevision||!next.snapshotRevision)throw Error('Credit history could not be checked as one snapshot. Refresh records before printing.');
 if(previous.snapshotRevision!==next.snapshotRevision)throw Error('Credit records changed while loading.');
 return {...next,invoices:[...previous.invoices,...next.invoices.filter(i=>!previous.invoices.some(old=>old.id===i.id))],entries:[...previous.entries,...next.entries.filter(e=>!previous.entries.some(old=>old.id===e.id))]};
}
