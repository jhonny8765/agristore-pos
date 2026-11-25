import type {Sale} from '@agristore/domain';
import {saveCheckout,type PosDatabase} from '@agristore/offline';
import {command} from './api';
/** Price review precedes NEW local completion. Durable originals never run a
 * new preflight: their historical payload is the cash/outbox record. */
export async function saveBranchCash(db:PosDatabase,payload:Sale,online:boolean,practice=false){
 if(online&&!practice&&!await db.sales.get(payload.transactionId)){
  const response=await command('validate_sale_prices',payload as unknown as Record<string,unknown>);
  if(response?.valid!==true)throw Error('The current selling prices could not be verified. Keep this basket and retry before taking payment.');
 }
 return saveCheckout(db,payload);
}
