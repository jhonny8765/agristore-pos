"use client";

import { CheckCheck } from 'lucide-react';
import { money } from '@agristore/domain';
import type { ConfirmedCreditSale } from '../lib/credit-confirmation';
import { SaleReceiptPrint } from './sale-receipt-print';
import { Button } from './ui/button';

export function CreditSaleConfirmation({ sale, branchName, onNewSale, onAccounts }: {
  sale: ConfirmedCreditSale; branchName: string; onNewSale: () => void; onAccounts?: () => void;
}) {
  return <section className="checkout-success credit-sale-success" aria-label="Confirmed credit sale">
    <div className="sale-success-mark"><CheckCheck size={30} aria-hidden="true" /></div>
    <h3 aria-live="polite">Credit sale confirmed.</h3>
    <div className="credit-confirmed-record">
      <h2>Credit sale record</h2>
      <p><strong>Better Yield · {branchName}</strong></p>
      <p><strong>{sale.clientName}</strong><br />Official booklet invoice: {sale.officialReference}</p>
      <dl className="compact-ledger">
        <div><dt>Sale total</dt><dd>{money(sale.total)}</dd></div>
        <div><dt>Cash paid now</dt><dd>{money(sale.cashReceived)}</dd></div>
        <div><dt>Balance on this invoice</dt><dd>{money(sale.balance)}</dd></div>
        <div><dt>Due date</dt><dd>{sale.dueOn}<small>{sale.term} calendar days · Asia/Manila</small></dd></div>
      </dl>
      <details className="credit-confirmed-items"><summary>Products and original reference</summary>
        <ul>{sale.items.map((item, index) => <li key={index}>{item.name} · {item.quantity} {item.unitName}<strong>{money(item.lineTotal)}</strong></li>)}</ul>
        <p>Original credit record: {sale.id}</p>
      </details>
      <p className="scope-note">This internal record links to the authorized manual booklet invoice. It is not a tax invoice. The balance shown is from this checkout; later payments appear in customer accounts.</p>
    </div>
    <SaleReceiptPrint id={sale.id} receipt={sale.officialReference} occurredAt="" branchName={branchName} items={sale.items} total={sale.total} cashReceived={sale.cashReceived} practice={false} paymentMode="credit" credit={sale}/>
    <Button variant="outline" onClick={() => window.print()}>Print credit record / Save PDF</Button>
    <p className="receipt-print-hint">58 mm roll · Portrait · Scale 100%<br/>Turn off headers and footers in print settings.</p>
    <Button onClick={onNewSale}>New sale</Button>
    {onAccounts && <Button variant="ghost" onClick={onAccounts}>Open customer accounts</Button>}
  </section>;
}
