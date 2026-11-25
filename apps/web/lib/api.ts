import { createClient } from "@supabase/supabase-js";
import type {
  Branch,
  Lease,
  Membership,
  Sale,
  Snapshot,
  SyncAck,
} from "@agristore/domain";
import { setting, setSetting, type PosDatabase, type Transport } from "@agristore/offline";
import { recordColumns } from "./record-columns";
import { commandError, isDatabaseRejection } from "./command-error";
import type {BranchNetwork} from './branch-network';
import type {BranchPriceBook} from './branch-pricing';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
    "http://127.0.0.1:55321",
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    "local-practice-placeholder",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          signal: init?.signal ?? AbortSignal.timeout(15000),
        }),
    },
  },
);
export async function command<T = Record<string, unknown>>(
  action: string,
  data: Record<string, unknown>,
): Promise<T> {
  if (!navigator.onLine)
    throw new Error(
      "Reconnect to use this action. Completed cash sales remain on this PC.",
    );
  const { data: result, error, status } = await supabase.rpc("agri_command", {
    action,
    data:action==='open_shift'||action==='renew_shift'?{...data,pcProtocol:1}:data,
  });
  if (error)
    throw commandError(error,status);
  return result as T;
}
export async function memberships(): Promise<Membership[]> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user)
    throw new Error(
      "Could not verify your store access. Reconnect and try again, or sign out and sign in again. Saved sales remain on this PC.",
    );
  const { data, error: queryError } = await supabase
    .from("staff_memberships")
    .select("*,organizations(name)")
    .eq("user_id", user.id)
    .eq("active", true);
  if (queryError) throw new Error(queryError.message);
  return (data ?? []).map((m) => ({
    organizationId: m.organization_id,
    organizationName:
      (m.organizations as { name: string })?.name ?? "AgriStore",
    branchId: m.branch_id,
    role: m.role,
    userId: m.user_id,
    name: m.name,
  }));
}
export async function branchNetwork(org:string):Promise<BranchNetwork>{
 return command<BranchNetwork>('branch_network',{organizationId:org});
}
export async function branchPriceBook(input:{organizationId:string;branchId:string;query:string;cursor?:string}):Promise<BranchPriceBook>{
 return command<BranchPriceBook>('branch_price_book',input);
}
export async function branches(org: string, permittedIds?:string[]): Promise<Branch[]> {
  const { data, error } = await supabase
    .from("branches")
    .select("id,name,code,managementLocked:management_locked,multiPc:multi_pc")
    .eq("organization_id", org)
    .eq("active", true)
    .order("code");
  if (error) throw new Error(error.message);
  return (data ?? []).filter(branch=>!permittedIds||permittedIds.includes(branch.id));
}
export async function requestSnapshot(db: PosDatabase | undefined, input: Record<string, unknown>): Promise<Snapshot> {
  const localRequestId = db ? crypto.randomUUID() : undefined;
  const archive=db&&typeof input.organizationId==='string'&&typeof input.branchId==='string'
    ?await setting<Snapshot['historyArchive']>(db,`testHistoryArchive:${input.organizationId}:${input.branchId}`):undefined;
  let catalogVersion = db ? await db.transaction("rw",db.settings,async()=>{
    await setSetting(db,"snapshotRequestId",localRequestId);
    return setting<string>(db,"catalogVersion");
  }) : undefined;
  const ids = Array.isArray(input.transactionIds) ? input.transactionIds : [];
  const confirmed = new Set<string>();
  let fullCatalog: Snapshot["products"] | undefined;
  let latest: Snapshot | undefined;
  // All earlier acknowledgments are included in the final, later stock snapshot:
  // completed sales are immutable. Never submit a lifetime-sized RPC body.
  for (let offset = 0; offset < Math.max(1,ids.length); offset += 1000) {
    latest = await command<Snapshot>("snapshot", { ...input, transactionIds: ids.slice(offset,offset+1000), ...(catalogVersion ? {catalogVersion} : {}),...(archive?{historyArchiveVersion:archive.id}:{}) });
    latest.confirmedIds.forEach(id => confirmed.add(id));
    if (!latest.catalogUnchanged) fullCatalog = latest.products;
    catalogVersion = latest.catalogVersion;
  }
  const localScope = typeof input.organizationId === "string" && typeof input.branchId === "string"
    ? { organizationId: input.organizationId, branchId: input.branchId } : undefined;
  return {...latest!, confirmedIds:[...confirmed], products:fullCatalog ?? [], catalogUnchanged:fullCatalog === undefined, ...(localRequestId ? {localRequestId} : {}), localScope};
}
export function cloudTransport(lease: Lease, db?: PosDatabase): Transport {
  const context = {
    organizationId: lease.organizationId,
    branchId: lease.branchId,
    deviceId: lease.deviceId,
  };
  return {
    async authorize() {
      if (!navigator.onLine) return false;
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error || user?.id !== lease.cashierId) return false;
      try {
        return (
          await command<{ authorized: boolean }>("authorize_shift", context)
        ).authorized;
      } catch (e) {
        if ((e as { code?: string }).code === "42501") return false;
        throw e;
      }
    },
    push: async (sale: Sale) => {
      if(db&&(await db.sales.get(sale.transactionId))?.allocation)throw Error('Use the original allocated cash receipt synchronizer for this sale');
      try {
        return await command<SyncAck>(
          "record_sale",
          sale as unknown as Record<string, unknown>,
        );
      } catch (e) {
        if (isDatabaseRejection(e))
          return {
            transactionId: sale.transactionId,
            status: "review",
            reason: e instanceof Error ? e.message : "Owner review required",
          };
        throw e;
      }
    },
    snapshot: (transactionIds: string[]) =>
      requestSnapshot(db, { ...context, transactionIds }),
  };
}
export async function rows(table: string, org: string, branch?: string, client = supabase) {
  let query = client.from(table).select(recordColumns(table)).eq("organization_id", org);
  if (branch) query = query.eq("branch_id", branch);
  const dateColumn = ["sales"].includes(table)
    ? "occurred_at"
    : ["cashier_shifts"].includes(table)
      ? "opened_at"
      : ["stock_transfers"].includes(table)
        ? "dispatched_at"
        : ["devices", "staff_memberships", "suppliers"].includes(table)
          ? "id"
          : "created_at";
  const { data, error } = await query
    .order(dateColumn, { ascending: false })
    .order("id", { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Record<string, unknown>[];
}

export interface SalesCursor {
  occurredAt: string;
  id: string;
}
export async function salesPage(
  org: string,
  branch: string,
  before?: SalesCursor,
  client = supabase,
) {
  let query = client
    .from("sales")
    .select("*,sale_reversals(id),sale_partial_refunds(id),sale_refund_corrections(id)")
    .limit(1,{referencedTable:"sale_partial_refunds"})
    .limit(1,{referencedTable:"sale_refund_corrections"})
    .eq("organization_id", org)
    .eq("branch_id", branch)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false });
  if (before) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        before.id,
      ) ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(
        before.occurredAt,
      ) ||
      !Number.isFinite(Date.parse(before.occurredAt))
    )
      throw new Error("Invalid receipt history cursor. Refresh the list.");
    // Preserve PostgreSQL microseconds; Date.toISOString() would truncate the
    // cursor and could skip receipts sharing the same millisecond.
    const date = before.occurredAt;
    query = query.or(
      `occurred_at.lt.${date},and(occurred_at.eq.${date},id.lt.${before.id})`,
    );
  }
  const { data, error } = await query.limit(51);
  if (error) throw new Error(error.message);
  const result = (data ?? []).slice(0, 50) as Record<string, unknown>[];
  const last = result.at(-1);
  return {
    rows: result,
    next:
      data && data.length > 50 && last
        ? { occurredAt: String(last.occurred_at), id: String(last.id) }
        : undefined,
  };
}

export interface ExpenseDrawerCursor {organizationId:string;branchId:string;openedAt:string;id:string}
export interface ExpenseDrawerChoice {id:string;deviceId:string;cashierId:string;openedAt:string;closedAt:string|null;pc:string;cashier:string}
export async function expenseDrawerChoices(org:string,branch:string,cursor?:ExpenseDrawerCursor):Promise<{items:ExpenseDrawerChoice[];nextCursor:ExpenseDrawerCursor|null}>{
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 if(cursor&&(cursor.organizationId!==org||cursor.branchId!==branch||!uuid.test(cursor.id)||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(cursor.openedAt)||!Number.isFinite(Date.parse(cursor.openedAt))))throw Error('Drawer lookup scope or cursor changed. Start with recent drawers.');
 let query=supabase.from('cashier_shifts').select('id,device_id,cashier_id,opened_at,closed_at').eq('organization_id',org).eq('branch_id',branch).order('opened_at',{ascending:false}).order('id',{ascending:false});
 if(cursor)query=query.or(`opened_at.lt.${cursor.openedAt},and(opened_at.eq.${cursor.openedAt},id.lt.${cursor.id})`);
 const shifts=await query.limit(1000);if(shifts.error)throw Error(shifts.error.message);
 const page=shifts.data??[];
 async function names(table:'devices'|'staff_memberships',column:'id'|'user_id',ids:string[]){
  const chunks:string[][]=[];for(let offset=0;offset<ids.length;offset+=100)chunks.push(ids.slice(offset,offset+100));
  const results=await Promise.all(chunks.map(values=>supabase.from(table).select(`${column},name`).eq('organization_id',org).in(column,values).limit(1000)));
  const labels=new Map<string,string>();for(const result of results){if(result.error)throw Error(result.error.message);for(const row of (result.data??[]) as unknown as Record<string,unknown>[])labels.set(String(row[column]),String(row.name));}return labels;
 }
 const [devices,staff]=await Promise.all([names('devices','id',[...new Set(page.map(s=>s.device_id))]),names('staff_memberships','user_id',[...new Set(page.map(s=>s.cashier_id))])]);
 const items=page.map(s=>({id:s.id,deviceId:s.device_id,cashierId:s.cashier_id,openedAt:s.opened_at,closedAt:s.closed_at as string|null,pc:devices.get(s.device_id)??'Registered PC',cashier:staff.get(s.cashier_id)??'Original cashier'})),last=items.at(-1);
 return {items,nextCursor:items.length===1000&&last?{organizationId:org,branchId:branch,openedAt:last.openedAt,id:last.id}:null};
}
