// Cast exact numeric fields before JSON serialization. Converting a parsed
// JavaScript number to a string cannot recover decimals or bigint IDs it lost.
const projections: Readonly<Record<string, string>> = {
  cashier_shifts:
    "id,organization_id,branch_id,device_id,cashier_id,opened_at,closed_at,opening_cash::text,counted_cash::text,expected_cash::text",
  stock_transfers:
    "id,organization_id,branch_id,destination_branch_id,product_id,batch_id,quantity::text,received_quantity::text,held_quantity::text,lost_quantity::text,returned_quantity::text,shipment_id,state,dispatched_by,dispatched_at,received_by,received_at",
  stock_counts:
    "id,organization_id,branch_id,product_id,batch_id,expected::text,counted::text,ledger_revision::text,reason,state,counted_by,approved_by,created_at,count_method,count_date",
  inventory_movements:
    "id::text,organization_id,branch_id,product_id,batch_id,quantity::text,kind,source_id,created_by,created_at,reversal_of::text",
  audit_events:
    "id::text,organization_id,branch_id,actor_id,action,source_id,details,created_at",
};

export function recordColumns(table: string) {
  return projections[table] ?? "*";
}
