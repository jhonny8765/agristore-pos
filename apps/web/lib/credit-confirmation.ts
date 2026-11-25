import { isCreditSaleTerm, saleItemSchema, type SaleItem } from '@agristore/domain';

export interface ConfirmedCreditSale {
  id: string;
  clientId: string;
  clientName: string;
  officialReference: string;
  dueOn: string;
  issuedOn: string;
  term: number;
  total: number;
  cashReceived: number;
  balance: number;
  items: SaleItem[];
}

/** Only a matching acknowledgement may settle the original durable request. */
export function verifyCreditAcknowledgement(data: Record<string, unknown>, result: Record<string, unknown>) {
  const total = data.total, cash = data.cashReceived;
  if (typeof data.requestId !== 'string' || result.id !== data.requestId ||
      !Number.isSafeInteger(total) || !Number.isSafeInteger(cash) ||
      Number(cash) < 0 || Number(total) <= Number(cash) ||
      (result.duplicate === true ? result.sourceId !== data.requestId :
        result.duplicate !== false || result.balance !== Number(total) - Number(cash) || result.dueOn !== data.expectedDueOn)) {
    throw new Error('The credit sale response could not be verified. Keep the original request in Sync center.');
  }
}

export function creditConfirmation(data: Record<string, unknown>, clientName?: string): ConfirmedCreditSale {
  if (typeof data.requestId !== 'string' || typeof data.clientId !== 'string' ||
      typeof data.officialReference !== 'string' || typeof data.expectedDueOn !== 'string' ||
      !isCreditSaleTerm(data.term) || !Array.isArray(data.items)) {
    throw new Error('Keep the original credit sale and check its saved record in Customers & credit.');
  }
  return {
    id: data.requestId, clientId: data.clientId,
    clientName: clientName || `Client account ${data.clientId.slice(0, 8).toUpperCase()}`,
    officialReference: data.officialReference.trim().toUpperCase(), dueOn: data.expectedDueOn,
    issuedOn: new Date(Date.parse(data.expectedDueOn+'T00:00:00Z')-Number(data.term)*86400000).toISOString().slice(0,10),
    term: data.term, total: Number(data.total), cashReceived: Number(data.cashReceived),
    balance: Number(data.total) - Number(data.cashReceived), items: data.items.map(item => saleItemSchema.parse(item)),
  };
}
