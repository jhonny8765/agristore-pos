import { createRoot } from "react-dom/client";
import { useState } from "react";
import { BlindCounts } from "../../apps/web/components/blind-counts";
import { RecordTable } from "../../apps/web/components/record-pages";
import { SearchSelect } from "../../apps/web/components/search-select";
import type { Product } from "@agristore/domain";
import type { PosDatabase } from "@agristore/offline";

const products: Product[] = Array.from({ length: 120 }, (_, n) => ({
  id: `product-${n}`, name: `Grower blend ${String(n).padStart(3, "0")}`, sku: `FEED-${n}`, ...{originalCode: `SHOP-${n}`},
  category: "Feeds", baseUnit: "kg", minimumStock: "123456789", tracksExpiry: false, active: true,
  units: [{ id: `unit-${n}`, name: "Sack", factor: "50", price: 3500, cost: 2000, priceVersion: 1 }],
  batches: [{ id: `lot-${n}`, lot: `LOT-${n}`, expiresOn: null }],
}));
function Fixture() {
  const [count, setCount] = useState(23), [selected, setSelected] = useState("");
  return <main><h1>List and search checks</h1><section aria-label="Receipt fixture">
    <h2>Receipts</h2><p>All receipts total: {count * 3500} centavos</p>
    <button onClick={() => setCount(4)}>Refresh with four records</button>
    <button onClick={() => setCount(33)}>Load another page</button>
    <RecordTable><thead><tr><th>Receipt</th><th>Amount</th></tr></thead><tbody>{Array.from({ length: count }, (_, n) => <tr key={n}><td>Receipt {n + 1}</td><td>3500</td></tr>)}</tbody></RecordTable>
  </section><BlindCounts db={{} as PosDatabase} organizationId="test" branchId="test" actorId="staff" products={products} owner={false} online disabled={false} revision={0} execute={async fn => { await fn(); return undefined; }} />
    <form aria-label="Controlled unit picker" onSubmit={e => e.preventDefault()}><label className="field"><span>Product unit</span><SearchSelect label="Product unit" options={products.map(p => ({ value: p.units[0].id, label: `${p.name} · Sack (50 kg)`, search: p.sku }))} required name="unit" value={selected} onChange={setSelected} /></label><button>Save unit</button><output>{selected}</output><button type="reset" onClick={() => setSelected("")}>Reset unit</button></form>
    <form aria-label="Optional supplier picker"><label className="field"><span>Optional supplier</span><SearchSelect label="Optional supplier" name="supplier" options={[{value:"supplier-1",label:"Agri supply"}]} /></label></form>
  </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
