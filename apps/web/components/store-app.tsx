"use client";
import {useTransientMessage} from "../lib/transient-message";
import {RecordReports} from "./record-reports";
import type {RecordKind} from "../lib/record-reports";
import { StateBadge } from "./state-badge";
import {CreditWorkspace} from './credit-workspace';
import {CreditCheckout} from './credit-checkout';
import {CreditSaleConfirmation} from './credit-sale-confirmation';
import type {ConfirmedCreditSale} from '../lib/credit-confirmation';
import { SearchableSelect } from "./search-select";
import { RecordTable, RecordPages } from "./record-pages";
import { HeldSaleControl } from "./held-sale";
import {confirmOnlineCash,onlineCashKey} from '../lib/online-cash';
import { prepareHeldCheckout,removeHeldSale,heldSaleKey,type HeldSale } from "../lib/held-sale";
import { DashboardAttention } from "./dashboard-attention";
import { OverviewAccounts } from "./overview-accounts";
import { AppUpdateNotice } from "./app-update-notice";
import { PriceHistory } from "./price-history";
import { receiptActionCells } from "../lib/receipt-actions";
import { OverviewDashboard } from "./overview-dashboard";
import { WorkspaceStat } from "./workspace-ui";
import { OrderWorkspace } from "./order-workspace";
import { ReceiptWorkspace } from "./receipt-workspace";
import { SaleReceiptPrint } from "./sale-receipt-print";
import {SupplierPurchaseFields,purchaseInvoice} from "./supplier-purchase-fields";
import { SupplierAccounts } from "./supplier-accounts";
import { InventoryWorkspace } from "./inventory-workspace";
import { SettingsWorkspace } from "./settings-workspace";
import {CashierPcMode} from './cashier-pc-mode';
import { WorkspaceTabs } from "./workspace-ui";
import type { ReceiptView } from "../lib/receipt-view";
import { MeasuredQuantity } from "./measured-quantity";
import { SalesAnalytics } from "./sales-analytics";
import { PartialRefundControl } from "./partial-refund";

/* WORLD: Reproduce the user-pinned November 3 screens: heavy sans, warm paper, forest rail, compact ledgers.
   STORY: Cashiers complete a cash sale; owners follow each stock change back to its source.
   FIRST VIEWPORT: A fixed narrow navigation rail, branch and connection bar, searchable product grid,
   and a persistent receipt at the right. The checkout action stays next to the amount due.
   FORM: The supplied eight-screen composition owns the design. Actual records, permissions and photos own content.
   FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowDownToLine,
  FileUp,
  FileDown,
  Wallet,
  Store as StoreFront,
  ArrowLeftRight,
  ArrowRight,
  BarChart3,
  Check,
  CheckCheck,
  ChevronDown,
  ClipboardCheck,
  CloudOff,
  FileText,
  Leaf,
  Menu,
  LogOut,
  Mail,
  Eye,
  EyeOff,
  Package,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBasket,
  Users,
  Sprout,
  Truck,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import Decimal from "decimal.js";
import Image from "next/image";
import { StoreBrand } from "./store-brand";
import { ProductSetupForm } from "./product-setup-form";
import { CheckoutProduct } from "./checkout-product";
import { ImportedProductReview } from "./imported-product-review";
import { resumeBranch } from "../lib/resume-branch";
import type { SaleEntry } from "../lib/cart";
import { SaleLineEditor } from "./sale-line-editor";
import { productStock } from "../lib/stock-display";
import { historicalStock, stockHistoryColumns } from "../lib/stock-history";
import {
  makeItem,
  lineAmounts,
  money,
  moneyInput, cashQuickAmounts, exactCentavos,
  requireLease,
  total,
  type Branch,
  type Lease,
  type Membership,
  type Product,
  type Sale,
  type Snapshot,
} from "@agristore/domain";
import {
  PosDatabase,
  applySnapshot,
  clearAccountCache,
  exportRecovery,
  exportRecoveryPart,
  forgetRetiredDevice,
  importRecovery,
  localStock,
  readLocalSales,
  retrySale,
  saveCheckout,
  setSetting,
  setting,
  syncOnce,
  unresolvedStates,
  type LocalSale,
} from "@agristore/offline";
import {
  branches as fetchBranches,
  cloudTransport,
  command,
  requestSnapshot,
  memberships,
  rows,
  salesPage,
  type SalesCursor,
  supabase,
} from "../lib/api";
import { practiceBranch, startPractice } from "../lib/practice";
import { cartAmount, draftLineTotal, hasCartErrors, useCart } from "../lib/cart";
import {
  onlineOperation,
  pendingOperations,
  retryOperation,
  requireNoPendingClosure,
  type PendingOperation,
} from "../lib/operations";
import { Button } from "./ui/button";
import { activateReadyUpdate, findReadyUpdate } from "../lib/pwa-update";
import { ApprovalForm } from "./approval-form";
import { HistoryRegister } from "./history-register";
import { StorageHealth } from "./storage-health";
import { useAppInstall } from "../lib/use-app-install";
import { OperatingGuide } from "./operating-guide";
import { StockControls } from "./stock-controls";
import { StockLossReport } from "./stock-loss-report";
import { PurchasingWorkspace } from "./purchasing-workspace";
import { BlindCounts } from "./blind-counts";
import { PasswordRecovery } from "./password-recovery";
import {encryptRecoveryBackup,decryptRecoveryBackup,isEncryptedRecoveryBackup,type EncryptedRecoveryBackup} from "../lib/recovery-encryption";
import { useServiceReachability } from "../lib/use-service-reachability";
import { preferredBatch, outstandingTransfer } from "../lib/stock-controls";
import type { HistoryKind } from "../lib/history";

type View =
  | "records"
  | "credit"
  | "pos"
  | "overview"
  | "inventory"
  | "receiving"
  | "transfers"
  | "counts"
  | "sales"
  | "sync"
  | "close-shift"
  | "settings";
type Row = Record<string, unknown>;
const navigation = [
  { id: "pos", label: "Checkout", icon: ShoppingBasket },
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "receiving", label: "Purchasing", icon: Truck },
  { id: "transfers", label: "Transfers", icon: ArrowLeftRight },
  { id: "sales", label: "Sales & receipts", icon: FileText },
  { id: "credit", label: "Customers & credit", icon: Users },
] as const;
const viewTables: Record<View, string[]> = {
  records: [],
  credit: [],
  pos: [],
  overview: ["audit_events", "cashier_shifts", "inventory_movements"],
  inventory: [],
  receiving: ["suppliers"],
  transfers: [],
  counts: [],
  sales: [],
  sync: [],
  "close-shift": [],
  settings: ["devices", "staff_memberships"],
};
const str = (row: Row, key: string) => String(row[key] ?? "");
const when = (value: unknown) =>
  value
    ? new Intl.DateTimeFormat("en-PH", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Asia/Manila",
      }).format(new Date(String(value)))
    : "Not yet";
const inputValue = (form: FormData, key: string) =>
  String(form.get(key) ?? "").trim();
const cents = (value: string) => {
  const d = new Decimal(value || 0).mul(100);
  if (!d.isInteger() || d.isNegative() || d.gt(Number.MAX_SAFE_INTEGER))
    throw new Error("Enter a valid amount with up to two decimal places");
  return d.toNumber();
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Empty({
  title,
  body,
  icon: Icon = Package,
}: {
  title: string;
  body: string;
  icon?: typeof Package;
}) {
  return (
    <div className="empty">
      <Icon size={32} strokeWidth={1.4} />
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}
function download(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function StoreApp() {
  const appInstall = useAppInstall();
  const [dispatchStock,setDispatchStock]=useState("");
  const [quickUnit,setQuickUnit]=useState("");
  const [quickSupplier,setQuickSupplier]=useState(""),[supplierBillTarget,setSupplierBillTarget]=useState("");
  const [partialRefundSaleId,setPartialRefundSaleId]=useState<string>();
  const [localHistoryLimit, setLocalHistoryLimit] = useState(50);
  const [hasOlderLocal, setHasOlderLocal] = useState(false);
  const recoveryFileInput=useRef<HTMLInputElement>(null);
  const [recoverySelected,setRecoverySelected]=useState("");
  const [secureExportPassphrase,setSecureExportPassphrase]=useState("");
  const [secureExportConfirmation,setSecureExportConfirmation]=useState("");
  const [encryptedRecoveryPending,setEncryptedRecoveryPending]=useState<{name:string;payload:EncryptedRecoveryBackup}>();
  const [encryptedRecoveryPassphrase,setEncryptedRecoveryPassphrase]=useState("");
  const [recoveryArchive, setRecoveryArchive] = useState<{ id: string; next: number; parts: number; scope: string }>();
  const [recoveryDownload, setRecoveryDownload] = useState<{ scope: string; filename: string; data: Awaited<ReturnType<typeof exportRecovery>>; payload?: EncryptedRecoveryBackup }>();
  const [allPendingCount, setAllPendingCount] = useState(0);
  const [branchPendingCount, setBranchPendingCount] = useState(0);
  const [allOperationCount, setAllOperationCount] = useState(0);
  const [branchOperationCount, setBranchOperationCount] = useState(0);
  const [practice, setPractice] = useState(false);
  const [operations, setOperations] = useState<PendingOperation[]>([]);
  const db = useMemo(
    () =>
      new PosDatabase(practice ? "agristore-practice-v1" : "agristore-live-v1"),
    [practice],
  );
  const [ready, setReady] = useState(false),
    [online, setOnline] = useState(true),
    [view, setView] = useState<View>("pos");
  const contentHeading = useRef<HTMLHeadingElement>(null);
  const previousView = useRef(view);
  const [lease, setLease] = useState<Lease>(),
    [member, setMember] = useState<Membership>(),
    [branchList, setBranchList] = useState<Branch[]>([]),
    [branchId, setBranchId] = useState("");
  const [signedIn, setSignedIn] = useState(false),
    [products, setProducts] = useState<Product[]>([]),
    [stock, setStock] = useState<Map<string, string>>(new Map()),
    [sales, setSales] = useState<LocalSale[]>([]);
  const [membershipCheck, setMembershipCheck] = useState<
    "pending" | "confirmed" | "failed"
  >("pending");
  const [cloud, setCloud] = useState<Record<string, Row[]>>({}),
    [olderCloudEnd,setOlderCloudEnd]=useState<Record<string,boolean>>({}),
    [olderCloudLoading,setOlderCloudLoading]=useState<string>(),
    [lastSync, setLastSync] = useState<string>(),
    [snapshotAt, setSnapshotAt] = useState<string>();
  const [message, setMessage] = useTransientMessage(),
    [error, setError] = useTransientMessage(),
    [busy, setBusy] = useState(false),
    [syncing, setSyncing] = useState(false),
    [registration, setRegistration] = useState<ServiceWorkerRegistration>();
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("All products"),
    [cash, setCash] = useState(""),
    [checkoutDone, setCheckoutDone] = useState<LocalSale>();
  const [creditDone,setCreditDone]=useState<ConfirmedCreditSale>();
  const [navigationOpen,setNavigationOpen]=useState(false);
  const navigationToggle=useRef<HTMLButtonElement>(null);
  const [heldDraftCount,setHeldDraftCount]=useState(0);
  useEffect(()=>{let active=true;if(lease)void setting<HeldSale>(db,heldSaleKey(lease)).then(value=>{if(active)setHeldDraftCount(value?1:0);});else setHeldDraftCount(0);return()=>{active=false;};},[db,lease]);
  const [closingDraft, setClosingDraft] = useState<{shiftId: string; cash: string}>();
  const closingCash = closingDraft?.shiftId === lease?.shiftId ? closingDraft?.cash ?? "" : "";
  const [inventoryQuery]=useState('');
  const [inventoryTab,setInventoryTab]=useState("products");
  const [inventoryReviewEntry,setInventoryReviewEntry]=useState<{serial:number;productId?:string;showCatalog:boolean}>({serial:0,showCatalog:false});
  const [inventoryReceiptJump,setInventoryReceiptJump]=useState(0);
  const [purchasingTab,setPurchasingTab]=useState("orders");
  const quickReceiptHeading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{
    if(view!=="receiving"||purchasingTab!=="quick"||!inventoryReceiptJump)return;
    const frame=requestAnimationFrame(()=>{quickReceiptHeading.current?.scrollIntoView({block:"start"});quickReceiptHeading.current?.focus();});
    return ()=>cancelAnimationFrame(frame);
  },[inventoryReceiptJump,view,purchasingTab]);
  const [syncQuery,setSyncQuery]=useState("");
  const [syncFilter,setSyncFilter]=useState("all");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [recoveryMode,setRecoveryMode]=useState<"request"|"update"|null>(null);
  const allowPublicSignup=process.env.NEXT_PUBLIC_STAFF_SIGNUP_ENABLED!=="false";
  const serviceStatus=useServiceReachability(online,!practice&&ready&&signedIn);
  const [showPassword, setShowPassword] = useState(false);
  const [salesCursor, setSalesCursor] = useState<SalesCursor>();
  const [savingSale, setSavingSale] = useState(false);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [overviewUnconfirmed,setOverviewUnconfirmed]=useState(0);
  const [updateFeedback, setUpdateFeedback] = useState("");
  const [installingUpdate, setInstallingUpdate] = useState(false);
  const updateLock = useRef(false);
  const [openingImport, setOpeningImport] = useState<{
    name: string;
    branchId: string;
    items: Record<string, unknown>[];
  }>();
  const [branchFeedback, setBranchFeedback] = useState<{
    kind: "pending" | "success" | "error";
    text: string;
  }>();
  const [recordTarget,setRecordTarget]=useState<{kind:RecordKind;entity?:{id:string;name:string};back:View}>({kind:"receipts",back:"overview"});
  const cart = useCart();
  const committing = useRef(false);
  const operationBusy = useRef(false);
  const syncingRef = useRef(false);
  const olderCloudLock = useRef(false);
  const contextGeneration = useRef(0);
  const cloudRequest = useRef(0);
  const [actionIssue,setActionIssue]=useState("");
  const notify = useCallback((text: string) => {
    setMessage(text);
    setError("");setActionIssue("");
  }, [setMessage,setError]);
  const fail = useCallback((e: unknown) => {
    const issue=
      e instanceof Error && "issues" in e
        ? (e as Error & { issues: { message: string }[] }).issues
            .map((i) => i.message)
            .join(". ")
        : e instanceof Error
          ? e.message
          : "Something went wrong. Your completed sales are still saved.";
    setActionIssue(issue);setError(issue);
    setMessage("");
  }, [setMessage,setError]);
  useEffect(()=>{setSupplierBillTarget("");setQuickSupplier("");},[branchId,member?.organizationId,member?.userId]);
  const checkoutScopeGeneration=contextGeneration.current;
  const openSupplierBill=(id:string)=>{if(checkoutScopeGeneration!==contextGeneration.current)return;setSupplierBillTarget(id);setPurchasingTab("accounts");};

  const selectedBranch = branchList.find((b) => b.id === branchId);
  const onlineCashOnly=!practice&&(selectedBranch?.multiPc===true||lease?.onlineOnly===true);
  const onlineCashPending=operations.find(op=>op.action==='record_online_sale');
  const branchLocked = branchList.some(b => b.managementLocked);
  const isOwner = member?.role === "owner";
  const openRecords=(kind:RecordKind="receipts",entity?:{id:string;name:string})=>{if(!isOwner||practice)return;setRecordTarget({kind,entity,back:view==="records"?recordTarget.back:view});setView("records");};
  const recoveryScopeKey = member && branchId
    ? JSON.stringify([member.organizationId, branchId, member.userId, member.role]) : undefined;
  useEffect(()=>{setEncryptedRecoveryPending(undefined);setEncryptedRecoveryPassphrase("");setSecureExportPassphrase("");setSecureExportConfirmation("");},[recoveryScopeKey]);
  const currentRecoveryArchive = recoveryArchive?.scope === recoveryScopeKey ? recoveryArchive : undefined;
  const currentRecoveryDownload = recoveryDownload?.scope === recoveryScopeKey ? recoveryDownload : undefined;
  const isStock = member?.role === "stock_staff";
  const pending = sales.filter((s) => s.status !== "synced");
  const context = useCallback(() => {
    if (!member || !branchId)
      throw new Error("Choose your business and branch first");
    return { organizationId: member.organizationId, branchId };
  }, [member, branchId]);
  const refreshLocal = useCallback(async () => {
    const generation = contextGeneration.current;
    const org = lease?.organizationId ?? member?.organizationId,
      b = lease?.branchId ?? branchId,
      user = lease?.cashierId ?? member?.userId,
      role = lease?.role ?? member?.role;
    const [nextProducts,nextStock,local,allOperations,lastSync,snapshotAsOf] = await db.transaction(
      "r",[db.products,db.stocks,db.sales,db.settings],()=>Promise.all([
        db.products.toArray(),localStock(db),org && b
          ? readLocalSales(db,{organizationId:org,branchId:b,cashierId:role === "owner" ? undefined : user},localHistoryLimit)
          : db.sales.where("status").anyOf(unresolvedStates).count().then(allPendingCount=>({sales:[],allPendingCount,branchPendingCount:0,hasOlder:false})),
        pendingOperations(db),setting<string>(db,"lastSync"),setting<string>(db,"snapshotAsOf"),
      ]),
    );
    if (generation !== contextGeneration.current) return;
    setProducts(nextProducts);
    setStock(nextStock);
    setSales(local.sales);
    setAllPendingCount(local.allPendingCount);
    setBranchPendingCount(local.branchPendingCount);
    setHasOlderLocal(local.hasOlder);
    setAllOperationCount(allOperations.length);
    setBranchOperationCount(allOperations.filter(op => op.data.organizationId === org && (!op.data.branchId || op.data.branchId === b)).length);
    setOperations(
      allOperations.filter(
        (op) =>
          op.data.organizationId === org &&
          (!op.data.branchId || op.data.branchId === b) &&
          (role === "owner" || op.actorId === user),
      ),
    );
    setLastSync(lastSync);
    setSnapshotAt(snapshotAsOf);
  }, [db, lease, member, branchId, localHistoryLimit]);
  const refreshCloud = useCallback(async (forceStock = false) => {
    if (practice || !member || !branchId || !navigator.onLine) return;
    const generation = contextGeneration.current;
    const request = ++cloudRequest.current;
    const [nextBranches, results, summary, snapshot, page] = await Promise.all([
      fetchBranches(member.organizationId),
      Promise.all(
        viewTables[view].map(
          async (t) => [t, await rows(t, member.organizationId)] as const,
        ),
      ),
      view !== "overview" || member.role === "stock_staff"
        ? Promise.resolve({})
        : command<Row>("dashboard", {
            organizationId: member.organizationId,
            branchId,
          }),
      !lease || forceStock
        ? requestSnapshot(db, {
            organizationId: member.organizationId,
            branchId,
            transactionIds: (
              await db.sales.where("status").anyOf(unresolvedStates).toArray()
            ).map((s) => s.id),
          })
        : Promise.resolve(undefined),
      view === "sales"
        ? salesPage(member.organizationId, branchId)
        : Promise.resolve(undefined),
    ]);
    if (
      generation !== contextGeneration.current ||
      request !== cloudRequest.current
    )
      return;
    if (snapshot) {
      await applySnapshot(db, snapshot);
      const nextStock = await localStock(db);
      if (
        generation !== contextGeneration.current ||
        request !== cloudRequest.current
      )
        return;
      if (!snapshot.catalogUnchanged) setProducts(snapshot.products);
      setStock(nextStock);
      setSnapshotAt(snapshot.asOf);
    }
    setBranchList(nextBranches);
    await setSetting(db, "branches", nextBranches);
    if (
      generation !== contextGeneration.current ||
      request !== cloudRequest.current
    )
      return;
    setCloud({
      ...Object.fromEntries(results),
      ...(page ? { sales: page.rows } : {}),
      summary: [summary],
    });
    setOlderCloudEnd({});
    setSalesCursor(page?.next);
  }, [practice, member, branchId, db, view, lease]);
  const loadOlderCloud = useCallback(async (table:string) => {
    if(practice || !member || !navigator.onLine || olderCloudLock.current || olderCloudEnd[table] || !viewTables[view].includes(table))return;
    const previous=cloud[table]??[];
    if(previous.length<1000)return;
    const context=contextGeneration.current,request=cloudRequest.current,scope=member.organizationId;
    olderCloudLock.current=true;setOlderCloudLoading(table);
    try{
      const page=await rows(table,scope,undefined,supabase,previous.length);
      if(context!==contextGeneration.current || request!==cloudRequest.current)return;
      const known=new Set(previous.map(row=>String(row.id)));
      const added=page.filter(row=>!known.has(String(row.id)));
      setCloud(current=>{
        if((current[table]??[]).length!==previous.length)return current;
        return {...current,[table]:[...previous,...added]};
      });
      if(page.length<1000 || added.length===0)setOlderCloudEnd(current=>({...current,[table]:true}));
    }catch(error){fail(error);}
    finally{olderCloudLock.current=false;setOlderCloudLoading(undefined);}
  },[practice,member,olderCloudEnd,cloud,view,fail]);
  const sync = useCallback(async () => {
    if (practice || !lease || !navigator.onLine || syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      await syncOnce(db, cloudTransport(lease, db));
    } catch (e) {
      fail(e);
    } finally {
      // A failed snapshot can follow committed outbox state changes. Show the
      // retained retry/authentication state even when the network step fails.
      await refreshLocal().catch(fail);
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [db, lease, practice, refreshLocal, fail]);
  useEffect(() => {
    const generation = ++contextGeneration.current;
    setActionIssue("");
    let alive = true;
    const current = () => alive && generation === contextGeneration.current;
    (async () => {
      setReady(false);
      setMembershipCheck("pending");
      if (!practice && localStorage.getItem("agristore-mode") === "practice") {
        setPractice(true);
        return;
      }
      await db.open();
      const saved = practice
        ? await startPractice(db)
        : await setting<Lease>(db, "lease");
      if (!current()) return;
      setLease(saved);
      setBranchId(saved?.branchId ?? "");
      if (practice) {
        setMembershipCheck("confirmed");
        setMember({
          organizationId: saved!.organizationId,
          organizationName: "Practice business",
          branchId: null,
          role: "owner",
          userId: saved!.cashierId,
          name: "Practice cashier",
        });
        setBranchList([practiceBranch]);
        setSignedIn(true);
      } else {
        const cachedMember = await setting<Membership>(db, "membership");
        const cachedBranches = (await setting<Branch[]>(db, "branches")) ?? [];
        const cachedScope = await setting<Snapshot["localScope"]>(db, "snapshotScope");
        if (!current()) return;
        setMember(cachedMember);
        setBranchList(cachedBranches);
        setBranchId(saved?.branchId ?? resumeBranch(cachedMember, cachedBranches, cachedScope) ?? "");
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!current()) return;
        if (new URLSearchParams(window.location.search).has("password-recovery")) {
          setRecoveryMode("update");setSignedIn(false);setMembershipCheck("confirmed");setReady(true);return;
        }
        setSignedIn(!!session || !!saved);
        if (navigator.onLine && session) {
          const found = await memberships();
          if (!current()) return;
          const m =
            found.find((m) => m.organizationId === saved?.organizationId) ??
            found[0];
          setMember(m);
          setMembershipCheck(
            m || (!cachedMember && !saved) ? "confirmed" : "failed",
          );
          if (!m && (cachedMember || saved))
            fail(
              new Error(
                "No active store access was returned. Ask your owner to check your account. Saved sales remain on this PC.",
              ),
            );
          if (m) {
            const b = await fetchBranches(m.organizationId);
            if (!current()) return;
            setBranchList(b);
            const savedBranchEnabled = !saved || b.some(branch => branch.id === saved.branchId);
            const retiredCachedBranch = cachedScope?.organizationId === m.organizationId && !b.some(branch => branch.id === cachedScope.branchId);
            if (!savedBranchEnabled || (!saved && retiredCachedBranch)) {
              // Retire authorization only; preserve all original sale/request evidence.
              const deviceId = await setting<string>(db, "deviceId");
              if (deviceId) await forgetRetiredDevice(db, deviceId);
              else await db.settings.delete("lease");
              setLease(undefined);
            }
            const target = (savedBranchEnabled ? saved?.branchId : undefined) ?? resumeBranch(m, b, cachedScope) ?? (m.role === "owner" ? b[0]?.id : b.find(branch => branch.id === m.branchId)?.id);
            setBranchId(target ?? "");
            await db.transaction("rw",db.settings,async()=>{
              if (!current()) return;
              await setSetting(db,"membership",m);
              await setSetting(db,"branches",b);
            });
            if (!current()) return;
            if (target)
              await applySnapshot(
                db,
                await requestSnapshot(db, {
                  organizationId: m.organizationId,
                  branchId: target,
                  deviceId: savedBranchEnabled ? saved?.deviceId : undefined,
                  transactionIds: (
                    await db.sales.where("status").anyOf(unresolvedStates).toArray()
                  ).map((s) => s.id),
                }),
              );
            if (!current()) return;
            if (m.role === "stock_staff") setView("inventory");
          }
        }
      }
      if (current()) setReady(true);
    })().catch((e) => {
      if (!current()) return;
      setMembershipCheck("failed");
      fail(e);
      setReady(true);
    });
    return () => {
      alive = false;
      db.close();
    };
  }, [db, practice, fail]);
  useEffect(() => {
    if (ready) void refreshLocal().catch(fail);
  }, [ready, refreshLocal, fail]);
  useEffect(() => {
    if (practice) return;
    const {data:{subscription}} = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {setRecoveryMode("update");setSignedIn(false);setReady(true);return;}
      if (event !== "SIGNED_OUT") return;
      // Auth broadcasts across windows. Clear this window immediately as well
      // as fencing any outstanding downloads; immutable sales remain intact.
      contextGeneration.current++;
      committing.current=false;setBusy(false);setSavingSale(false);setNavigationOpen(false);
      setRecoveryArchive(undefined);
      setRecoveryDownload(undefined);
      cloudRequest.current++;
      useCart.getState().clear();
      setSignedIn(false);
      setReady(true);
      setMember(undefined);
      setLease(undefined);
      setCloud({});
      setProducts([]);
      setStock(new Map());
      setBranchList([]);
      setBranchId("");
      setSales([]);
      setOperations([]);
      setSalesCursor(undefined);
      setCheckoutDone(undefined);setCreditDone(undefined);
      setSnapshotAt(undefined);
      setLastSync(undefined);
      setOpeningImport(undefined);
      void clearAccountCache(db).catch(fail);
    });
    return () => subscription.unsubscribe();
  }, [db, practice, fail]);
  useEffect(() => {
    if (previousView.current === view) return;
    previousView.current = view;
    if (ready && signedIn) contentHeading.current?.focus();
  }, [view, ready, signedIn]);
  useEffect(() => {
    if (ready && view !== "pos") void refreshCloud().catch(fail);
  }, [ready, view, refreshCloud, fail]);
  useEffect(() => {
    setOnline(navigator.onLine);
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    if (!ready || !online || recoveryMode) return;
    const syncVisible=()=>{if(document.visibilityState==="visible"&&!operationBusy.current)void sync();};
    syncVisible();const timer=setInterval(syncVisible,15_000);
    document.addEventListener("visibilitychange",syncVisible);
    return ()=>{clearInterval(timer);document.removeEventListener("visibilitychange",syncVisible);};
  }, [ready, online, sync, recoveryMode]);
  useEffect(() => {
    const location = new URL(window.location.href);
    if (location.searchParams.has("app-update")) {
      location.searchParams.delete("app-update");
      window.history.replaceState(window.history.state, "", location.href);
    }
  }, []);
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !online ||
      !("serviceWorker" in navigator)
    )
      return;
    let alive = true;
    void navigator.serviceWorker
      .register("/sw.js")
      .then((r) => {
        if (alive) setRegistration(r);
      })
      .catch(fail);
    return () => {
      alive = false;
    };
  }, [fail, online]);
  const run = async (fn: () => Promise<void>, refresh = true, forceStock = false) => {
    if (operationBusy.current)
      return new Error(
        "Wait for the current operation to finish, then try again.",
      );
    operationBusy.current = true;
    setBusy(true);
    setError("");
    const generation = contextGeneration.current;
    let completed = false;
    try {
      await fn();
      completed = true;
      if (generation === contextGeneration.current && refresh) {
        await refreshCloud(forceStock);
      }
    } catch (e) {
      if (completed) {
        // The write is confirmed. A failed read must not turn it into a failed
        // submission or invite a second stock movement/product/supplier.
        fail(new Error("Your action completed, but the latest records could not be refreshed. Do not submit it again. Reconnect and select Refresh."));
        return;
      }
      fail(e);
      return e instanceof Error
        ? e
        : new Error(
            "Could not confirm this action. Your original request is retained.",
          );
    } finally {
      if (generation === contextGeneration.current && refresh) {
        setHistoryRevision((revision) => revision + 1);
        await refreshLocal().catch(fail);
      }
      operationBusy.current = false;
      setBusy(false);
    }
  };
  async function auth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(async () => {
      contextGeneration.current++;
      setRecoveryArchive(undefined);
      setRecoveryDownload(undefined);
      setCloud({});
      setProducts([]);
      setStock(new Map());
      await clearAccountCache(db);
      const email = inputValue(form, "email"),
        password = String(form.get("password") ?? "");
      if(authMode==="signup"&&!allowPublicSignup)throw new Error("Ask the Better Yield owner to authorize your account.");
      const result =
        authMode === "login"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({
              email,
              password,
              options: { emailRedirectTo: window.location.origin },
            });
      if (result.error) throw result.error;
      if (!result.data.session) {
        notify("Check your email to confirm your account, then sign in.");
        return;
      }
      const found = await memberships();
      setMembershipCheck("confirmed");
      if (found[0]) {
        const b = await fetchBranches(found[0].organizationId);
        const target = found[0].branchId ?? b[0]?.id;
        if (!target) throw new Error("Ask your owner to assign your branch.");
        const snapshot = await requestSnapshot(db, {
          organizationId: found[0].organizationId,
          branchId: target,
          transactionIds: (
            await db.sales.where("status").anyOf(unresolvedStates).toArray()
          ).map((s) => s.id),
        });
        await applySnapshot(db, snapshot);
        const nextStock = await localStock(db);
        if (!snapshot.catalogUnchanged) setProducts(snapshot.products);
        setStock(nextStock);
        setSnapshotAt(snapshot.asOf);
        setBranchList(b);
        setBranchId(target);
        await setSetting(db, "membership", found[0]);
        await setSetting(db, "branches", b);
      }
      setMember(found[0]);
      setView(found[0]?.role === "stock_staff" ? "inventory" : "pos");
      setSignedIn(true);
      notify("Signed in.");
    });
  }
  async function openShift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    await run(async () => {
      await requireNoPendingClosure(db, member!.organizationId, branchId);
      let deviceId = await setting<string>(db, "deviceId");
      if (!deviceId) {
        deviceId = crypto.randomUUID();
        await setSetting(db, "deviceId", deviceId);
      }
      if (isOwner || member?.role === "manager")
        await command("register_device", {
          ...context(),
          deviceId,
          name: "Cashier PC",
        });
      const next = await command<Lease>("open_shift", {
        ...context(),
        deviceId,
        openingCash: cents(inputValue(f, "opening")),
      });
      await setSetting(db, "lease", next);
      setLease(next);
      const transport = cloudTransport(next, db);
      await applySnapshot(
        db,
        await transport.snapshot((await db.sales.where("status").anyOf(unresolvedStates).toArray()).map((s) => s.id)),
      );
      notify("Shift open. Your product catalog is saved on this PC.");
    });
  }
  async function exportLocalRecovery(passphrase?:string) {
    if (!member || !branchId || !recoveryScopeKey)
      throw new Error("Select your authorized branch before exporting recovery records.");
    const generation = contextGeneration.current;
    const scope = { organizationId: member.organizationId, branchId, cashierId: isOwner ? undefined : member.userId };
    const data = currentRecoveryArchive
      ? await exportRecoveryPart(db, currentRecoveryArchive.id, currentRecoveryArchive.next, scope)
      : await exportRecovery(db, scope);
    if (generation !== contextGeneration.current) return;
    const encrypted=passphrase ? await encryptRecoveryBackup(data,passphrase) : undefined;
    if (generation !== contextGeneration.current) return;
    const filename = `agristore-recovery-${data.archive.id}-part-${data.archive.part}-of-${data.archive.parts}${encrypted?".encrypted":""}.json`;
    // Keep only this bounded part for a blocked/misplaced download retry. It is
    // never a second export or a new checkout, and is cleared on context changes.
    setRecoveryDownload({ scope: recoveryScopeKey, filename, data, payload:encrypted });
    setRecoveryArchive(data.archive.part < data.archive.parts
      ? { id: data.archive.id, next: data.archive.part + 1, parts: data.archive.parts, scope: recoveryScopeKey } : undefined);
    download(filename, encrypted??data);
    notify(`${encrypted?"Encrypted d":"D"}ownload started for recovery part ${data.archive.part} of ${data.archive.parts}. Check your browser Downloads or chosen folder; the app cannot confirm the file was saved.`);
  }
  async function restoreRecoveryInput(input:unknown) {
    const recovery=input as {sales?:LocalSale[]}|null;
    if(!recovery || !Array.isArray(recovery.sales) || recovery.sales.length>100000)throw new Error("Invalid recovery file");
    const confirmed:string[]=[];
    for(let offset=0;offset<recovery.sales.length;offset+=1000){
      const snapshot=await requestSnapshot(db,{...context(),transactionIds:recovery.sales.slice(offset,offset+1000).map(s=>s.payload.transactionId)});
      confirmed.push(...snapshot.confirmedIds);
      await applySnapshot(db,snapshot);
    }
    const count=await importRecovery(db,input,confirmed,{organizationId:member!.organizationId,branchId,cashierId:member!.userId,role:member!.role});
    notify(`${count} sale records checked and restored. Original transaction IDs and online requests are retained. Review the Sync center before retrying.`);
  }
  function recoveryDownloadNotice() {
    if (!currentRecoveryDownload) return null;
    const { filename, data, payload } = currentRecoveryDownload;
    return <section className="recovery-download" aria-label="Prepared recovery download">
      <h3>Check your recovery download</h3>
      <p>Part {data.archive.part} of {data.archive.parts} · {data.archive.recordCount} sale records · {data.pendingOperations.length} stock / owner requests in this file. This export covers {data.archive.totalRecords} sale records.</p>
      <p className="recovery-filename">{filename}</p>
      <p>Check your browser Downloads or chosen folder. The app cannot confirm the file was saved. If it is missing or blocked, download this same part again.</p>
      <Button variant="outline" disabled={busy} onClick={() => void run(async () => {
        download(filename, payload??data);
        notify(`Download started again for part ${data.archive.part} of ${data.archive.parts}. Check Downloads or your chosen folder. Original records are unchanged.`);
      }, false)}>Download this part again</Button>
      <p className="muted">Keep every part private. New sales need a new export. This retry keeps the same records and does not advance to the next part. After closing or reloading the app, start a fresh export for any unresolved records.</p>
    </section>;
  }
  async function finishSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (committing.current || updateLock.current) return;
    committing.current = true;
    setBusy(true);
    setSavingSale(true);
    try {
      if(cart.credit.enabled||cart.creditAttempt)throw new Error('Confirm the original credit sale before using cash checkout.');
      requireLease(lease);
      if(onlineCashOnly&&!navigator.onLine)throw new Error('Multiple-PC checkout needs internet confirmation. Keep this basket and reconnect before taking payment or handing over goods.');
      const original=onlineCashOnly?await setting<PendingOperation>(db,onlineCashKey(lease.organizationId,lease.branchId)):undefined;
      if (!original&&!cart.items.length)
        throw new Error("Add a product to the receipt first");
      if (!original&&hasCartErrors(useCart.getState()))
        throw new Error(
          "Check quantities, discounts and confirmed weighed amounts before checkout.",
        );
      const payload: Sale = original?original.data as unknown as Sale:{
        version: 1,
        transactionId: cart.attempt(),
        organizationId: lease.organizationId,
        branchId: lease.branchId,
        deviceId: lease.deviceId,
        cashierId: lease.cashierId,
        shiftId: lease.shiftId,
        occurredAt: new Date().toISOString(),
        items: cart.items,
        total: total(cart.items),
        cashReceived: cents(cash),
      };
      const heldId=useCart.getState().heldDraftId;
      if(heldId){const draft=useCart.getState();await prepareHeldCheckout(db,lease,heldId,payload,{lineIds:[...draft.lineIds],drafts:structuredClone(draft.drafts),quantityErrors:{...draft.quantityErrors},cash});}
      const saved = onlineCashOnly?await confirmOnlineCash(db,lease,payload):await saveCheckout(db, payload);
      if(heldId){try{await removeHeldSale(db,lease,heldId);setHeldDraftCount(0);}catch{fail(new Error("Sale saved. A held-draft copy remains on this PC; it cannot be charged again. Remove it after checking the original receipt."));}}
      setCheckoutDone(saved);
      cart.clear();
      setCash("");
      await refreshLocal();
      notify(
        practice
          ? "Practice sale saved on this PC."
          : onlineCashOnly?"Cash sale confirmed online. Receipt saved on this PC.":"Cash sale saved on this PC.",
      );
      void sync();
    } catch (e) {
      fail(e);
    } finally {
      committing.current = false;
      setBusy(false);
      setSavingSale(false);
      await refreshLocal();
    }
  }
  function addProduct(
    p: Product,
    unitId?: string,
    batchId?: string | null,
    entry: SaleEntry = "unit",
  ) {
    if (updateLock.current || committing.current || !lease || isStock) return;
    if(useCart.getState().creditAttempt||onlineCashPending){fail(new Error('Confirm the original sale in Sync center before changing this basket.'));return;}
    if(p.pricePending||p.setupPending||!p.active||!p.units.length){fail(new Error('The owner must confirm this product’s price and selling unit in Inventory.'));return;}
    try {
      const batch = preferredBatch(p,stock,new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }));
      cart.add(
        makeItem(
          p,
          unitId ?? p.units[0].id,
          "1",
          batchId === undefined ? batch : batchId,
        ),
        entry,
      );
      setCheckoutDone(undefined);setCreditDone(undefined);
    setMessage("");
    } catch (e) {
      fail(e);
    }
  }
  async function logout() {
    await run(async () => {
      if (practice) {
        contextGeneration.current++;
        setRecoveryArchive(undefined);
        setRecoveryDownload(undefined);
        localStorage.removeItem("agristore-mode");
        cart.clear();
        setPractice(false);
        setMember(undefined);
        setLease(undefined);
        setSignedIn(false);
        return;
      }
      if (!navigator.onLine)
        throw new Error(
          "Reconnect before signing out. Keep this PC and its saved records.",
        );
      if (syncingRef.current)
        throw new Error(
          "Wait for the current synchronization to finish before signing out.",
        );
      contextGeneration.current++;
      setRecoveryArchive(undefined);
      setRecoveryDownload(undefined);
      const result = await supabase.auth.signOut();
      if (result.error) throw result.error;
      await clearAccountCache(db);
      cart.clear();
      setCloud({});
      setProducts([]);
      setStock(new Map());
      setBranchList([]);
      setBranchId("");
      setSales([]);
      setSnapshotAt(undefined);
      setLastSync(undefined);
      setSalesCursor(undefined);
      setCheckoutDone(undefined);setCreditDone(undefined);
      setBranchFeedback(undefined);
      setOpeningImport(undefined);
      setUpdateFeedback("");
      setLease(undefined);
      setMember(undefined);
      setSignedIn(false);
      notify("Signed out. Saved sales remain on this PC for recovery.");
    });
  }
  const productName = (id: unknown) =>
    products.find((p) => p.id === id)?.name ?? String(id ?? "");
  const stockLabel = (row: Row) => {
    const stock = historicalStock(products, row);
    return (
      <>
        <strong>{stock.name}</strong>
        <small>{stock.lot}</small>
        {stock.expiresOn && <small>Expiry: {stock.expiresOn}</small>}
      </>
    );
  };
  const dispatchOptions=useMemo(()=>products.flatMap(p=>p.batches.length?p.batches.map(b=>`${p.id}:${b.id}`):[`${p.id}:none`]),[products]);
  const dispatchSelection=dispatchOptions.includes(dispatchStock)?dispatchStock:"";
  const dispatchProduct=products.find(p=>p.id===dispatchSelection.split(":")[0]);
  const quickProduct=products.find(p=>p.units.some(u=>u.id===quickUnit));
  const quickSellingUnit=quickProduct?.units.find(u=>u.id===quickUnit);
  const stockQuantity = (row: Row, quantity: string) =>
    `${new Decimal(quantity).toFixed()} ${historicalStock(products, row).baseUnit || "(base unit unavailable)"}`;
  const branchName = (id: unknown) =>
    branchList.find((b) => b.id === id)?.name ?? "Branch";
  const table = (
    headers: string[],
    body: React.ReactNode,
    kind?: HistoryKind,
  ) => {
    if(view === "sales") {
      const actionCells=practice?new Map<string,React.ReactNode>():receiptActionCells(body);
      const receipts:ReceiptView[]=practice?sales.map(s=>({id:s.id,receipt:s.receipt??s.id.slice(0,8),occurredAt:s.payload.occurredAt,total:s.payload.total,cashReceived:s.payload.cashReceived,status:"local",payload:s.payload,original:s as unknown as Row})):branchSales.map(s=>({id:String(s.id),receipt:String(s.receipt??String(s.id).slice(0,8)),occurredAt:String(s.occurred_at),total:Number(s.total),cashReceived:Number(s.cash_received),status:Array.isArray(s.sale_refund_corrections)&&s.sale_refund_corrections.length?"corrected":s.sale_reversals&&(!Array.isArray(s.sale_reversals)||s.sale_reversals.length)?"refunded":Array.isArray(s.sale_partial_refunds)&&s.sale_partial_refunds.length?"partial":s.review_required===true?"review":"completed",payload:s.payload as Sale,original:s}));
      return <ReceiptWorkspace onRecords={!practice&&isOwner?()=>openRecords("receipts"):undefined} header={pageHeading} key={`${member?.organizationId}:${branchId}:${practice}`} rows={receipts} products={products} branchName={selectedBranch?.name??"Selected branch"} practice={practice} actions={r=>actionCells.get(r.id)}/>;
    }
    return (<div
      className={kind ? "table-wrap history-table" : "table-wrap"}
      data-kind={kind}
      role="region"
      tabIndex={0}
      aria-label={
        kind
          ? `${{ purchases: "Receiving", transfers: "Transfer", counts: "Count", audit: "Audit" }[kind]} history records`
          : `${titles[view]}: ${headers.slice(0, 2).join(", ")}`
      }
    >
      <RecordTable key={`${member?.organizationId}:${branchId}:${view}:${kind ?? headers.join("|")}:${view === "inventory" ? inventoryQuery : ""}`}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{body}</tbody>
      </RecordTable>
    </div>);
  };
  const historyProps = {
    organizationId: member?.organizationId ?? "",
    branchId,
    branchName: selectedBranch?.name ?? "Branch",
    online,
    disabled: busy,
    revision: historyRevision,
  };
  const Notice = (
    <>
      {error && (
        <div role="alert" className="notice error">
          <span>{error}</span>
          <button aria-label="Dismiss error" onClick={() => setError("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {!error&&actionIssue&&<details className="action-issue"><summary>Review the last action message</summary><p>{actionIssue}</p><Button variant="ghost" onClick={()=>setActionIssue("")}>Dismiss reviewed message</Button></details>}
      {message && (
        <div role="status" className="notice success">
          <Check size={17} />
          <span>{message}</span>
          <button aria-label="Dismiss message" onClick={() => setMessage("")}>
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
  if (!ready)
    return (
      <div className="loading">
        <Sprout size={34} />
        <p>Opening Better Yield…</p>
      </div>
    );
  if (recoveryMode)
    return <PasswordRecovery mode={recoveryMode} onBack={async()=>{
      if(recoveryMode==="update")await supabase.auth.signOut();
      const location=new URL(window.location.href);location.searchParams.delete("password-recovery");
      window.history.replaceState(window.history.state,"",location.pathname+location.search);
      setRecoveryMode(null);setAuthMode("login");
    }} onComplete={()=>{
      const location=new URL(window.location.href);location.searchParams.delete("password-recovery");
      window.history.replaceState(window.history.state,"",location.pathname+location.search);
      setRecoveryMode(null);setAuthMode("login");
    }} />;
  if (!signedIn)
    return (
      <main className="auth-page">
        <section className="auth-story" aria-label="Better Yield">
          <div className="wordmark">
            <StoreBrand />
          </div>
          <div className="auth-story-main">
            <h1>
              Your partner in
              <br />
              every harvest.
            </h1>
            <p>
              Better Yield Agri Trading and Services
              <br />
              Crop nutrition · Crop care
            </p>
            <figure className="auth-photo">
              <Image
                src="/brand/better-yield-display.jpg"
                alt="Better Yield’s agricultural product display and branded booth"
                width={880}
                height={960}
                loading="eager"
                unoptimized
              />
              <figcaption>From the Better Yield team</figcaption>
            </figure>
            <div className="auth-proof" aria-label="Point of sale benefits">
              <span><ShoppingBasket size={21} aria-hidden="true" /> Fast checkout</span>
              <span><Package size={21} aria-hidden="true" /> Stock records</span>
              <span><ShieldCheck size={21} aria-hidden="true" /> Your store</span>
            </div>
          </div>
          <a
            className="auth-foot"
            href="https://www.facebook.com/profile.php?id=100054562864276"
            target="_blank"
            rel="noreferrer"
          >
            Better Yield on Facebook <ArrowRight size={16} />
          </a>
        </section>
        <section className="auth-form" aria-label="Store sign in">
          <div className="auth-form-inner">
            <span className="small-brand">
              <StoreBrand />
            </span>
            <span className="auth-branch">
              <ShieldCheck size={17} aria-hidden="true" />
              Magpet Branch
            </span>
            <h2>
              {authMode === "login"
                ? "Welcome back."
                : "Create your account."}
            </h2>
            <p>
              {authMode === "login"
                ? "Sign in to open your shift and get started."
                : "Create your sign-in account, then ask the store owner to grant branch access."}
            </p>
            {Notice}
            <form onSubmit={auth}>
              <Field label="Email address">
                <div className="auth-input-wrap">
                  <Mail size={19} aria-hidden="true" />
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="you@example.com"
                  />
                </div>
              </Field>
              <Field label="Password">
                <div className="auth-input-wrap auth-password-wrap">
                  <ShieldCheck size={19} aria-hidden="true" />
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={
                      authMode === "login" ? "current-password" : "new-password"
                    }
                    minLength={authMode==="signup"?8:undefined}
                    required
                    placeholder={authMode==="login"?"Your password":"At least 8 characters"}
                  />
                  <button
                    type="button"
                    className="auth-password-toggle"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((visible) => !visible)}
                  >
                    {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
              </Field>
              <Button disabled={busy || !online} type="submit">
                {busy
                  ? "Please wait…"
                  : authMode === "login"
                    ? "Sign in"
                    : "Create account"}
                <ArrowRight size={19} />
              </Button>
            </form>
            {authMode==="login"&&<button type="button" className="text-button auth-switch" onClick={()=>setRecoveryMode("request")}>Forgot password?</button>}
            {allowPublicSignup ? <button type="button" className="text-button auth-switch" onClick={()=>{setAuthMode(authMode==="login"?"signup":"login");setShowPassword(false);}}>{authMode==="login"?"New employee? Create a sign-in account":"Already registered? Sign in"}</button> : <p className="auth-access-note">New staff member? Ask the Better Yield administrator to authorize your account.</p>}
            <div className="practice-entry">
              <span>OR</span>
              <Button
                variant="outline"
                onClick={() => {
                  localStorage.setItem("agristore-mode", "practice");
                  cart.clear();
                  setPractice(true);
                }}
              >
                <ShoppingBasket size={18} aria-hidden="true" />
                Try practice checkout
                <ArrowRight size={18} aria-hidden="true" />
              </Button>
              <small>
                Sample products. Separate local data. No real transactions.
              </small>
            </div>
          </div>
        </section>
      </main>
    );
  if (!member && membershipCheck !== "confirmed")
    return (
      <main className="setup-page">
        <div className="setup-panel">
          <ShieldCheck size={34} />
          <h1>Check your store access.</h1>
          <p>
            Your account access could not be confirmed. Reconnect and retry, or
            sign out and sign in again. Your saved sales remain on this PC.
          </p>
          {Notice}
          <div className="peso-entry-actions">
            <Button
              disabled={!online || busy}
              onClick={() => window.location.reload()}
            >
              Retry account check
            </Button>
            <Button
              variant="ghost"
              disabled={busy || !online}
              onClick={() => void logout()}
            >
              Sign out
            </Button>
          </div>
        </div>
      </main>
    );
  if (!member)
    return (
      <main className="setup-page">
        <div className="setup-panel">
          <Sprout size={34} />
          <h1>Your account needs store access.</h1>
          <p>
            To use the existing Better Yield store, ask the current administrator to
            authorize your account for Magpet, then sign in again. This sign-in
            cannot create a separate business or grant access to existing records.
          </p>
          {Notice}
          <Button variant="ghost" onClick={() => void logout()}>
            Sign out
          </Button>
        </div>
      </main>
    );
  const categories = [
    "All products",
    ...new Set(products.filter(p=>p.active).map((p) => p.category)),
  ];
  const visible = products.filter(
    (p) =>
      p.active &&
      (category === "All products" || p.category === category) &&
      `${p.name} ${p.sku}`.toLowerCase().includes(query.toLowerCase()),
  );
  const checkedGrandTotal = cartAmount(
    cart.items.filter((item, index) =>
      draftLineTotal(item, cart.drafts[cart.lineIds[index]]) !== null,
    ),
  );
  const grandTotal=checkedGrandTotal??0;
  const discountedItems=cart.items.filter((item,index)=>draftLineTotal(item,cart.drafts[cart.lineIds[index]])!==null);
  const grossSubtotal=discountedItems.reduce((n,item)=>n+BigInt(lineAmounts(item).gross),0n);
  const discountTotal=discountedItems.reduce((n,item)=>n+BigInt(lineAmounts(item).discount),0n);
  let change = 0;
  try {
    change = Math.max(0, cents(cash) - grandTotal);
  } catch {}
  const branchSales = (cloud.sales ?? []).filter(
    (s) => s.branch_id === branchId,
  );
  const visibleQueue = sales.filter(s=>(`${s.id} ${s.receipt??""}`.toLowerCase().includes(syncQuery.toLowerCase()))&&(syncFilter==="all"||syncFilter==="synced"&&s.status==="synced"||syncFilter==="pending"&&(s.status==="pending"||s.status==="sending")||syncFilter==="attention"&&s.status!=="synced"&&s.status!=="pending"&&s.status!=="sending"));
  const summary = cloud.summary?.[0] ?? {};
  const summaryExact=(summary.exactTotals??{}) as Row;
  const branchCash=(id:string)=>{const row=branchTotals.find(t=>t.branchId===id);return (((row?.exactTotals??{}) as Row).total??row?.total??0) as number|string;};
  const branchTotals = (summary.branchTotals ?? []) as Row[];
  const titles: Record<View, string> = {
    records: "Records & exports",
    credit: "Customers & credit",
    pos: "Checkout",
    overview: "Overview",
    inventory: "Inventory",
    receiving: "Purchasing & receiving",
    transfers: "Branch transfers",
    counts: "Inventory",
    sales: "Sales & receipts",
    sync: "Sync center",
    "close-shift": "Close shift",
    settings: "Store settings",
  };
  const descriptions: Record<View, string> = {
    records: "Search full history and export the records you need.",
    credit: "Track customer invoices, due dates and payments.",
    pos: "Search, add items, then choose payment.",
    overview: "Your store, at a glance.",
    inventory: "Know what’s on hand, down to the last kilo.",
    receiving: "Track orders and inspect every delivery.",
    transfers: "Follow stock from dispatch to arrival.",
    counts: "Count the shelf, then reconcile the record.",
    sales: "Every completed checkout, with its original record.",
    sync: "Keep every saved record accounted for.",
    "close-shift": "Count the cash in your drawer, then finish your shift.",
    settings: "Manage your people, branch and cashier PC.",
  };
  const openInventoryReview=(product?:Product,showCatalog=false)=>{
    setInventoryReviewEntry(old=>({serial:old.serial+1,productId:product?.id,showCatalog:showCatalog||!!product}));
    setInventoryTab("review");
    setView("inventory");
  };
  const receiveInventory=(product?:Product)=>{
    setQuickUnit(product?.units[0]?.id??"");
    setPurchasingTab("quick");
    setView("receiving");
    setInventoryReceiptJump(n=>n+1);
  };
  const inventoryTabs = (<WorkspaceTabs label="Inventory sections" value={view==="counts"?"counts":["setup","prices","expiry"].includes(inventoryTab)?"products":inventoryTab} onChange={id=>{if(id==="counts")setView("counts");else if(id==="review")openInventoryReview();else {setInventoryTab(id);setView("inventory");}}} tabs={[{id:"products",label:"Products"},...(member.role!=="cashier"?[{id:"counts",label:"Stock counts"},{id:"controls",label:"Stock activity"}]:[]),...(isOwner?[{id:"review",label:"Needs review"}]:[])]}/>);
  const pageHeading = (<div className="page-heading">
            <div>
              <div className="title-line"><h1 ref={contentHeading} tabIndex={-1}>
                {titles[view]}
              </h1>{view==="sales"&&<span className="cash-mode-badge"><Wallet size={22}/>Sales records</span>}{lease&&view==="pos"&&<span className="shift-badge"><span/>Shift open</span>}</div>
              <p>{descriptions[view]}</p>
            </div>
            <div className="heading-actions">
              {!practice&&isOwner&&["overview","inventory","counts","receiving"].includes(view)&&!(view==="receiving"&&purchasingTab==="accounts")&&<Button variant="outline" onClick={()=>openRecords(view==="receiving"?"purchases":view==="inventory"?"stock":view==="counts"?"audit":"receipts")}>Records & exports</Button>}


              {!practice && view !== "pos" && view !== "sync" && view !== "overview" && view !== "credit" && view !== "records" && !(view === "receiving" && purchasingTab === "accounts") && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!online || busy || practice}
                  onClick={() =>
                    void run(async () => {
                      await refreshCloud(true);
                      if (lease) await sync();
                      setHistoryRevision((revision) => revision + 1);
                      notify("Records refreshed.");
                    }, false)
                  }
                >
                  <RefreshCw size={15} />
                  Refresh
                </Button>
              )}
            </div>
          </div>);
  return (
    <div className="app-shell reference-ui">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      {navigationOpen&&<button className="navigation-backdrop" tabIndex={-1} aria-label="Close navigation" onClick={()=>{setNavigationOpen(false);navigationToggle.current?.focus();}}/>}
      <aside onBlur={e=>{if(navigationOpen&&!e.currentTarget.contains(e.relatedTarget as Node|null))setNavigationOpen(false);}} className={`sidebar${navigationOpen?' navigation-open':''}`} onKeyDown={e=>{if(e.key==='Escape'){setNavigationOpen(false);navigationToggle.current?.focus();}}}>
        <button ref={navigationToggle} type="button" className="navigation-toggle" aria-expanded={navigationOpen} aria-controls="store-navigation" onClick={()=>setNavigationOpen(open=>!open)}>{navigationOpen?<X size={22}/>:<Menu size={22}/>}<span>{navigationOpen?'Close menu':'Menu'}</span></button>
        <a
          href="#main"
          className="wordmark"
          aria-label="Better Yield Point of Sale home"
        >
          <StoreBrand />
        </a>
        <nav id="store-navigation" aria-label="Main navigation">
          {navigation
            .filter(n => (!branchLocked && !practice) || n.id !== "transfers")
            .filter(
              (n) => !isStock || !["pos", "overview", "sales", "credit"].includes(n.id),
            )
            .map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                title={label}
                aria-label={id === "pos" ? `${label} POS` : label}
                className={view === id || id === "inventory" && view === "counts" || id === "overview" && view === "records" ? "nav-item active" : "nav-item"}
                aria-current={view === id || id === "inventory" && view === "counts" || id === "overview" && view === "records" ? "page" : undefined}
                onClick={() => {setView(id);setNavigationOpen(false);}}
              >
                <Icon size={19} />
                {label}
                {id === "pos" ? " " : ""}
                {id === "pos" && (
                  <span className="nav-shortcut" aria-hidden="true">
                    POS
                  </span>
                )}
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className={view === "sync" ? "nav-item active" : "nav-item"}
            aria-current={view === "sync" ? "page" : undefined}
            onClick={() => {setView("sync");setNavigationOpen(false);}}
          >
            <RefreshCw size={18} />
            Sync center
            {pending.length > 0 && (
              <span className="count-badge">{pending.length}</span>
            )}
          </button>
          <button
            className={view === "settings" ? "nav-item active" : "nav-item"}
            aria-current={view === "settings" ? "page" : undefined}
            onClick={() => {setView("settings");setNavigationOpen(false);}}
          >
            <Settings size={18} />
            Settings
          </button>
          <div className="sidebar-note">
            <Leaf size={19} />
            <span>
              A little more clarity.
              <br />
              Every single day.
            </span>
          </div>
          <button
            className="profile"
            disabled={busy || syncing}
            onClick={() => void logout()}
            title={practice ? "Leave practice mode" : "Sign out"}
          >
            <span className="avatar">{member.name.charAt(0)}</span>
            <span>
              <strong>{member.name}</strong>
              <small>
                {practice ? "Practice mode" : member.role.replace("_", " ")}
              </small>
            </span>
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="branch-picker">
            <span className="branch-icon">
              <StoreFront size={23} />
            </span>
            {branchLocked ? <span><span className="sr-only">Current branch: </span><strong>{selectedBranch?.name ?? "Reconnect to load your branch"}</strong></span> : <><select
              aria-label="Current branch"
              value={branchId}
              disabled={!!lease || busy || (!online && !practice)}
              onChange={(e) => {
                const nextBranchId = e.target.value;
                void run(async () => {
                  contextGeneration.current++;
                  setRecoveryArchive(undefined);
                  setRecoveryDownload(undefined);
                  const snapshot = await requestSnapshot(db, {
                    organizationId: member.organizationId,
                    branchId: nextBranchId,
                    transactionIds: (
                      await db.sales
                        .where("status")
                        .anyOf(unresolvedStates)
                        .toArray()
                    ).map((sale) => sale.id),
                  });
                  await applySnapshot(db, snapshot);
                  const nextStock = await localStock(db);
                  // Change the displayed branch and its stock together. Failed
                  // downloads leave the previously loaded branch selected.
                  setBranchId(nextBranchId);setCreditDone(undefined);setCheckoutDone(undefined);setNavigationOpen(false);
                  setOpeningImport(undefined);
                  setCloud({});
                  setSalesCursor(undefined);
                  if (!snapshot.catalogUnchanged) setProducts(snapshot.products);
                  setStock(nextStock);
                  setSnapshotAt(snapshot.asOf);
                  notify("Branch stock loaded.");
                });
              }}
            >
              {!branchId && <option value="" disabled>Reconnect to identify branch</option>}
              {branchList
                .filter((b) => isOwner || b.id === member.branchId)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
            </select>
            <ChevronDown size={14} /></>}
          </div>
          <div className="topbar-right">
            <span className={`connection ${online&&serviceStatus==="available"?"":"offline"}`} title={practice?"Sample practice data":`Browser: ${online?"online":"offline"} · Service: ${serviceStatus} · Sync: ${syncing?"running":lastSync?"last completed "+lastSync:"not confirmed"}`}>
              {online&&serviceStatus==="available"?<Wifi size={15} />:<WifiOff size={15} />}
              <span>{practice?"Practice data":!online?(onlineCashOnly?"Offline · checkout paused":"Offline · sales saved here"):serviceStatus==="checking"?"Checking store service…":serviceStatus==="unavailable"?"Store service unavailable":syncing?"Syncing store…":"Service reachable"}</span>
            </span>
            {lease && view!=="close-shift" && (<Button className="close-shift-shortcut" variant="outline" size="sm" disabled={busy || savingSale || installingUpdate}
                  onClick={() => setView("close-shift")}>
                  <LogOut size={15} /> Close shift
                </Button>)}<button className="account-chip" title={practice?"Leave practice mode":"Sign out"} aria-label={practice?"Practice mode · Sample data. Return to sign in":"Sign out "+member.name+" · "+member.role.replaceAll("_"," ")} disabled={busy||syncing} onClick={()=>void logout()}>{practice?"Practice mode · Sample data":member.name+" · "+member.role.replaceAll("_"," ")}</button>
          </div>
        </header>
        <main data-view={view} id="main" className="main-content" tabIndex={-1}>
          {view !== "pos" && view !== "sales" && (view!=="credit"||practice) && pageHeading}
          <div className="app-notices">{Notice}{!practice&&isOwner&&view!=="pos"&&viewTables[view].some(table=>(cloud[table]?.length??0)>=1000)&&<section className="notice" aria-label="Older workspace records"><p>These workspace lists load in pages of up to 1,000 records. Open Records &amp; exports for a filtered, verified history; refresh returns to the newest preview.</p><div className="button-row">{viewTables[view].every(table=>(cloud[table]?.length??0)<1000||olderCloudEnd[table])&&<span role="status">All available older preview rows are loaded for this view.</span>}{viewTables[view].filter(table=>(cloud[table]?.length??0)>=1000&&!olderCloudEnd[table]).map(table=><Button key={table} type="button" variant="outline" size="sm" disabled={!online||busy||!!olderCloudLoading} onClick={()=>void loadOlderCloud(table)}>{olderCloudLoading===table?"Loading older records…":`Load older ${table.replaceAll("_"," ")}`}</Button>)}</div></section>}</div>
          {view==="records"&&!practice&&isOwner&&<><Button variant="ghost" onClick={()=>setView(recordTarget.back)}>Back to {titles[recordTarget.back]}</Button><RecordReports key={`${member.organizationId}:${branchId}:${recordTarget.kind}:${recordTarget.entity?.id??"all"}`} organizationId={member.organizationId} branchId={branchId} branchName={selectedBranch?.name??"Selected branch"} online={online} initialKind={recordTarget.kind} entity={recordTarget.entity}/></>}
          {!practice&&<AppUpdateNotice registration={registration} onOpen={()=>setView("settings")}/>}
          {!practice && view === "overview" && (
            <details className="overview-scope-note"><summary>Report scope</summary><p className="muted">
              Sales totals include all confirmed records. Flag, reconciliation
              and movement previews show up to the most recent 1,000 entries.
              The audit register below has its own branch and date filters.
            </p></details>
          )}
          {!lease && !isStock && view === "pos" && (
            <section className="start-shift">
              <div>
                <ShieldCheck size={24} />
                <h2>Open your cashier shift</h2>
                <p>
                  We’ll register this PC and save the latest catalog before you
                  begin.
                </p>
              </div>
              <form onSubmit={openShift}>
                <Field label="Opening cash (₱)">
                  <input
                    name="opening"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue="0"
                    required
                  />
                </Field>
                <Button disabled={!online || busy}>
                  Open shift
                  <ArrowRight size={16} />
                </Button>
              </form>
            </section>
          )}
          {view === "pos" && (
            <div className="checkout-layout">
              <section className="catalog">{pageHeading}
                <div className="catalog-tools">
                  <label className="search-box">
                    <Search size={19} />
                    <input
                      aria-label="Search products"
                      placeholder="Search products or scan a barcode…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && visible.length === 1)
                          addProduct(visible[0]);
                      }}
                    />
                    <kbd>↵</kbd>
                  </label>
                  <button
                    className="reset-search"
                    aria-label="Reset search and filters"
                    onClick={() => {
                      setQuery("");
                      setCategory("All products");
                    }}
                  >
                    <RefreshCw size={16} />
                    <span>Reset</span>
                  </button>
                </div>
                <div
                  className="category-tabs"
                  role="group"
                  aria-label="Product categories"
                >
                  {categories.map((c) => (
                    <button
                      key={c}
                      className={c === category ? "selected" : ""}
                      aria-pressed={c === category}
                      onClick={() => setCategory(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                {visible.length ? (
                  <><h2 className="sr-only">Products</h2><RecordPages className="product-grid" label="Products" pageSize={6} paginationPosition="bottom" resetKey={`${query}:${category}`}>
                    {visible.map((p) => {
                      const available = productStock(p, stock);
                      return <CheckoutProduct key={p.id} product={p} available={available} unavailable={!lease||isStock||installingUpdate} disabled={!lease||isStock||busy||installingUpdate} onAdd={(unitId,mode)=>addProduct(p,unitId,undefined,mode)}/>;
                    })}
                  </RecordPages></>
                ) : (
                  <Empty
                    title={
                      query
                        ? "No products match your search"
                        : "Your catalog starts here"
                    }
                    body={
                      query
                        ? "Try a product name or SKU."
                        : "Add products under Inventory, then receive your opening stock."
                    }
                  />
                )}
                <div className="catalog-meta">
                  <span>{visible.length} products</span>
                  <span>Prices in Philippine pesos</span>
                </div>
                <div className="catalog-foot">
                  <ShieldCheck size={15} />
                  <span>
                    {snapshotAt
                      ? `Catalog saved ${when(snapshotAt)}. Stock includes sales waiting to sync.`
                      : "Open a shift online to save your product catalog."}
                  </span>
                </div>
              </section>
              <aside
                className="receipt-panel"
                id="current-sale"
                tabIndex={-1}
                aria-label="Current sale"
              >
                <div className="receipt-heading">
                  <div>
                    <h2>Current sale</h2>
                    <span>
                      {cart.items.length}{" "}
                      {cart.items.length === 1 ? "item" : "items"} · {cart.credit.enabled||creditDone&&!cart.items.length?'Credit':'Cash'} payment
                    </span>
                  </div>
                  <span className="cash-mode-badge"><Wallet size={18}/>{cart.credit.enabled||creditDone&&!cart.items.length?'Credit':'Cash'} payment</span>
                </div>
                {creditDone && !cart.items.length ? <CreditSaleConfirmation sale={creditDone} branchName={selectedBranch?.name??"Magpet Branch"} onNewSale={()=>{setCreditDone(undefined);setCash('');}} onAccounts={()=>setView("credit")}/> : checkoutDone && !cart.items.length ? (
                  <div className="checkout-success">
                    <div className="sale-success-mark">
                      <CheckCheck size={30} />
                    </div>
                    <h3>Sale saved.</h3>
                    <strong>{money(checkoutDone.payload.total)}</strong>
                    <p>
                      {money(
                        checkoutDone.payload.cashReceived -
                          checkoutDone.payload.total,
                      )}{" "}
                      change
                    </p>
                    <SaleReceiptPrint {...checkoutDone.payload} id={checkoutDone.id} receipt={checkoutDone.receipt} branchName={selectedBranch?.name??"Magpet Branch"} practice={practice}/>
                    <small>
                      {practice
                        ? "Practice record"
                        : (checkoutDone.receipt ??
                          checkoutDone.id.slice(0, 8))}{" "}
                      · Saved on this PC
                    </small>
                    <Button variant="outline" onClick={() => window.print()}>
                      Print 58 mm receipt
                    </Button><Button onClick={()=>{setCheckoutDone(undefined);setCreditDone(undefined);setCash('');}}>New sale</Button><Button variant="ghost" onClick={()=>setView("sales")}>View saved receipts</Button>
                    <p className="receipt-print-hint">58 mm roll · Portrait · Scale 100%<br/>Turn off headers and footers in print settings.</p>
                  </div>
                ) : cart.items.length ? (
                  <div className="receipt-items">
                    {cart.items.map((item, i) => (
                      <SaleLineEditor
                        key={cart.lineIds[i]}
                        lineId={cart.lineIds[i]}
                        item={item}
                        product={products.find((p) => p.id === item.productId)!}
                        index={i}
                        canDiscount={practice||member.role==='owner'||member.role==='cashier'}
                        disabled={busy || installingUpdate || !!cart.creditAttempt || !!onlineCashPending}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="receipt-empty">
                    <ShoppingBasket size={38} strokeWidth={1.2} />
                    <h3>Ready for the first item.</h3>
                    <p>Add a product to set its quantity and peso discount.</p>
                  </div>
                )}
                {onlineCashOnly&&<p className="notice" role="status">Multiple cashier PCs · Every sale requires online confirmation. Each PC keeps its own drawer.</p>}
                {onlineCashPending&&<p className="notice" role="status">Original cash sale awaiting confirmation · {money(Number(onlineCashPending.data.total))} · Cash tendered {money(Number(onlineCashPending.data.cashReceived))}. Retry this original sale or use Sync center. Do not collect payment again.</p>}
                {!((checkoutDone||creditDone)&&!cart.items.length)&&!practice&&<div className="credit-payment-choice" role="group" aria-label="Payment type"><Button type="button" variant={!cart.credit.enabled?'default':'outline'} disabled={busy||!!cart.creditAttempt||!!onlineCashPending} onClick={()=>useCart.setState({credit:{...cart.credit,enabled:false}})}>Cash</Button><Button type="button" variant={cart.credit.enabled?'default':'outline'} disabled={busy||!!cart.creditAttempt||!!onlineCashPending} onClick={()=>useCart.setState({credit:{...cart.credit,enabled:true}})}>Credit · 30/60/90 days</Button></div>}
                {!((checkoutDone||creditDone)&&!cart.items.length)&&(cart.credit.enabled&&!practice?<CreditCheckout key={`${member.organizationId}:${branchId}:${member.userId}`} db={db} organizationId={member.organizationId} branchId={branchId} lease={lease} online={online} disabled={busy||installingUpdate||isStock} onWorking={working=>{if(checkoutScopeGeneration!==contextGeneration.current)return;committing.current=working;setBusy(working);}} onSaved={async saved=>{if(checkoutScopeGeneration!==contextGeneration.current)return;const heldId=useCart.getState().heldDraftId;if(heldId&&lease){try{await removeHeldSale(db,lease,heldId);if(checkoutScopeGeneration!==contextGeneration.current)return;setHeldDraftCount(0);}catch{if(checkoutScopeGeneration!==contextGeneration.current)return;fail(new Error('Credit sale confirmed. A held copy remains; retry its original request to confirm, then remove it.'));}}if(checkoutScopeGeneration!==contextGeneration.current)return;cart.clear();setCash('');setCheckoutDone(undefined);setCreditDone(saved);setHistoryRevision(n=>n+1);notify('Credit sale confirmed. Print the linked credit record or start a new sale.');await sync();if(checkoutScopeGeneration!==contextGeneration.current)return;await refreshLocal();}}/>:<form className="payment-form" onSubmit={finishSale}>
                  <div className="subtotal">
                    <span>Subtotal</span>
                    <span>{money(grossSubtotal)}</span>
                  </div>
                  {discountTotal>0&&<div className="subtotal discount-total"><span>Product discounts</span><span>−{money(discountTotal)}</span></div>}
                  <div className="amount-due">
                    <span>Amount due</span>
                    <strong>{checkedGrandTotal===null?'Check sale total':money(grandTotal)}</strong>
                  </div>
                  <Field label="Cash received (₱)">
                    <input
                      aria-label="Cash received"
                      inputMode="decimal"
                      type="number"
                      min="0"
                      step="0.01"
                      value={cash}
                      onChange={(e) => setCash(e.target.value)}
                      placeholder="0.00"
                      required={!onlineCashPending}
                      disabled={!!onlineCashPending||busy}
                    />
                  </Field>
                  <div className="cash-shortcuts">
                    {cashQuickAmounts(grandTotal)
                      .map((v, i) => (
                        <button
                          type="button"
                          key={v}
                          disabled={!!onlineCashPending||busy}
                          onClick={() => setCash(moneyInput(v))}
                        >
                          {i === 0 ? "Exact" : money(v)}
                        </button>
                      ))}
                  </div>
                  <div className="change">
                    <span>Change</span>
                    <strong>{money(change)}</strong>
                  </div>
                  {hasCartErrors(cart) && (
                    <p className="quantity-error" role="alert">
                      Check quantities, discounts, sale totals and weighed amounts before
                      checkout.
                    </p>
                  )}
                  <Button
                    type="submit"
                    disabled={
                      busy ||
                      installingUpdate ||
                      !lease ||
                      (!onlineCashPending&&!cart.items.length) ||
                      (!onlineCashPending&&hasCartErrors(cart)) ||
                      (onlineCashOnly&&!online) ||
                      isStock
                    }
                    className="complete-sale"
                  >
                    {savingSale ? "Saving sale…" : onlineCashPending?"Confirm original cash sale":"Complete cash sale"}
                    <ArrowRight size={18} />
                  </Button>
                  <span className="payment-note">
                    <ShieldCheck size={13} />
                    {practice
                      ? "Practice sales never upload"
                      : onlineCashOnly?"Wait for online confirmation before handing over goods":"Saved on this PC before checkout completes"}
                  </span>
                </form>)}
                {(!((checkoutDone||creditDone)&&!cart.items.length)||heldDraftCount>0)&&lease&&<HeldSaleControl onWorking={working=>{committing.current=working;setBusy(working);}} db={db} lease={lease} cash={cash} onCash={setCash} disabled={busy||savingSale||installingUpdate||isStock||!!onlineCashPending} revision={checkoutDone?.id??String(historyRevision)} onChange={()=>{setCheckoutDone(undefined);setCreditDone(undefined);void setting<HeldSale>(db,heldSaleKey(lease)).then(value=>setHeldDraftCount(value?1:0)).catch(()=>fail(new Error("Could not check the held draft. Keep site data and retry.")));}}/>}
              </aside>
              <div className="mobile-basket">
                <div>
                  <span>
                    {cart.items.length}{" "}
                    {cart.items.length === 1 ? "item" : "items"} · Amount due
                  </span>
                  <strong>{checkedGrandTotal===null?'Check sale total':money(grandTotal)}</strong>
                </div>
                <a className="button" href="#current-sale">
                  Review sale <ArrowRight size={17} />
                </a>
              </div>
            </div>
          )}

          {view === "credit" && <CreditWorkspace onRecords={isOwner?openRecords:undefined} standaloneHeading key={`${member.organizationId}:${branchId}:${member.userId}`} db={db} organizationId={member.organizationId} branchId={branchId} actorId={member.userId} owner={isOwner} online={online} disabled={busy||savingSale||installingUpdate} lease={lease} practice={practice} revision={historyRevision} execute={fn=>run(fn,true,true)}/>}
          {view === "overview" && (
            <>{practice&&<OverviewDashboard figures={[money(sales.reduce((n,r)=>n+r.payload.total,0)),String(sales.length),money(sales.length?Math.round(sales.reduce((n,r)=>n+r.payload.total,0)/sales.length):0),money(sales.reduce((n,r)=>n+r.payload.total,0))]} trend={Object.entries(sales.reduce<Record<string,number>>((a,r)=>{const date=new Date(Date.parse(r.payload.occurredAt)+8*3600000).toISOString().slice(0,10);a[date]=(a[date]??0)+r.payload.total;return a;},{})).sort(([a],[b])=>a.localeCompare(b)).map(([date,grossSales])=>({date,grossSales:String(grossSales)}))} topProducts={products.flatMap(p=>{const items=sales.flatMap(r=>r.payload.items).filter(i=>i.productId===p.id);return items.length?[{id:p.id,name:p.name,product:p,quantity:items.reduce((n,i)=>n.plus(new Decimal(i.quantity).mul(i.factor)),new Decimal(0)).toFixed(),baseUnit:p.baseUnit,amount:money(items.reduce((n,i)=>n+i.lineTotal,0))}]:[];})} attention={<DashboardAttention practice products={products} stock={stock} pendingCounts={0} onInventory={pane=>{setInventoryTab(pane);setView("inventory");}} onCounts={()=>setView("counts")}/>} activity={<dl className="compact-ledger"><div><dt>Practice receipts saved</dt><dd>{sales.length}</dd></div><div><dt>Live uploads</dt><dd>None</dd></div><div><dt>Stock scope</dt><dd>Local practice</dd></div></dl>} cash={<><dl className="compact-ledger"><div><dt>Practice cash sales</dt><dd>{money(sales.reduce((n,r)=>n+r.payload.total,0))}</dd></div><div><dt>Drawer count</dt><dd>Not counted</dd></div></dl><p className="muted">Separate from business cash.</p></>} scope="Practice overview · Local-only sample sales. Your live business is separate."/>}
              {!practice && (isOwner || member.role === "manager") && <SalesAnalytics accounts={isOwner?<OverviewAccounts key={`${member.organizationId}:${branchId}`} organizationId={member.organizationId} branchId={branchId} online={online} revision={historyRevision} onCustomers={()=>setView("credit")} onSuppliers={()=>{setPurchasingTab("accounts");setView("receiving");}}onUnconfirmed={setOverviewUnconfirmed}/>:undefined} catalog={products} attention={<DashboardAttention canReview={isOwner} unconfirmedDueCount={overviewUnconfirmed} onCustomers={()=>setView("credit")} products={products} stock={stock} pendingCounts={Number(summary.pendingCounts??0)} onInventory={pane=>{setInventoryTab(pane);setView("inventory");}} onCounts={()=>setView("counts")}/>} key={`sales-analytics:${member.organizationId}:${branchId}:${member.userId}`} organizationId={member.organizationId} branchId={branchId} branchName={selectedBranch?.name ?? "Selected branch"} online={online} disabled={busy} revision={historyRevision} />}

              <details className="extra-registers"><summary>All-time totals, cash reconciliation & audit</summary><h2>All-time recorded totals</h2>
              <div className="summary-strip">
                <div>
                  <span>Recorded sales · {branchLocked ? selectedBranch?.name : "all branches"}</span>
                  <strong>{money((summaryExact.grossSales ?? summary.grossSales ?? 0) as number|string)}</strong>
                  <small>
                    {Number(summary.transactions ?? 0)} completed transactions
                  </small>
                </div>
                <div>
                  <span>Net cash refunds</span>
                  <strong>{money((summaryExact.netRefunds ?? summary.netRefunds ?? summary.refunds ?? 0) as number|string)}</strong>
                  <small>Paid {money((summaryExact.refunds ?? summary.refunds ?? 0) as number|string)} · Recovered {money((summaryExact.refundRecoveries ?? summary.refundRecoveries ?? 0) as number|string)}</small>
                </div>
                <div>
                  <span>In-transit transfers</span>
                  <strong>{Number(summary.inTransit ?? 0)}</strong>
                  <small>Awaiting destination receipt</small>
                </div>
                <div>
                  <span>Pending count approvals</span>
                  <strong>{Number(summary.pendingCounts ?? 0)}</strong>
                  <small>Owner review required</small>
                </div>
              </div>
              <div className="two-column">
                <section className="panel">
                  <h2>Branch activity</h2>
                  {table(
                    ["Branch", "Cash sales", "Last synchronized"],
                    branchList.map((b) => (
                      <tr key={b.id}>
                        <td>
                          <strong>{b.name}</strong>
                          <small>{b.code}</small>
                        </td>
                        <td>
                          {money(branchCash(b.id))}
                        </td>
                        <td>
                          {when(
                            branchTotals.find((t) => t.branchId === b.id)
                              ?.lastSync,
                          )}
                        </td>
                      </tr>
                    )),
                  )}
                </section>
                <section className="panel">
                  <h2>Stock investigations</h2>
                  <p>{Number(summary.openStockExceptions ?? 0)} unresolved investigations {isOwner ? "across your branches" : "at this branch"}. They remain open until the owner records the outcome.</p>
                  <p className="muted">Choose a branch, then open Inventory to review its oldest unresolved cases, held goods and stock issues.</p>
                  <Button variant="outline" onClick={() => setView("inventory")}>Open stock controls</Button>
                </section>
              </div>
              {!practice && (isOwner || member.role === "manager") && <StockLossReport singleBranch={branchLocked} key={`loss-report:${member.organizationId}:${branchId}`} db={db} organizationId={member.organizationId} branchId={branchId} branchName={selectedBranch?.name ?? "Selected branch"} actorId={member.userId} products={products} owner={isOwner} online={online} disabled={busy} revision={historyRevision} execute={fn => run(fn,true,true)} />}
              <section className="panel">
                <h2>Cash reconciliation</h2>
                {(cloud.cashier_shifts ?? []).length ? (
                  table(
                    [
                      "Branch",
                      "Opened",
                      "Status",
                      "Expected cash",
                      "Counted cash",
                      "Difference",
                    ],
                    (cloud.cashier_shifts ?? []).map((sh) => (
                      <tr key={str(sh, "id")}>
                        <td>{branchName(sh.branch_id)}</td>
                        <td>{when(sh.opened_at)}</td>
                        <td>{sh.closed_at ? "Closed" : "Open"}</td>
                        <td>
                          {sh.expected_cash === null
                            ? "Awaiting close"
                            : money((sh.expected_cash) as number|string)}
                        </td>
                        <td>
                          {sh.counted_cash === null
                            ? "Not counted"
                            : money((sh.counted_cash) as number|string)}
                        </td>
                        <td>
                          {sh.counted_cash === null || sh.expected_cash === null
                            ? "Needs reconciliation"
                            : money(
                                exactCentavos(sh.counted_cash as number|string) -
                                  exactCentavos(sh.expected_cash as number|string),
                              )}
                        </td>
                      </tr>
                    )),
                  )
                ) : (
                  <p className="muted">
                    Shift reconciliations will appear after the first shift
                    opens.
                  </p>
                )}
              </section>
              <section className="panel">
                <h2>Recent stock movements</h2>
                {(cloud.inventory_movements ?? []).length ? (
                  table(
                    ["Product", "Branch", "Movement", "Quantity", "Recorded"],
                    [...(cloud.inventory_movements ?? [])]
                      .slice(0, 12)
                      .map((r) => (
                        <tr key={str(r, "id")}>
                          <td>{productName(r.product_id)}</td>
                          <td>{branchName(r.branch_id)}</td>
                          <td>
                            <span className="status-tag">
                              {str(r, "kind").replaceAll("_", " ")}
                            </span>
                          </td>
                          <td className="numeric">{str(r, "quantity")}</td>
                          <td>{when(r.created_at)}</td>
                        </tr>
                      )),
                  )
                ) : (
                  <Empty
                    title="The stock book is ready"
                    body="Receiving, sales, transfers, and approved counts create permanent entries here."
                  />
                )}
              </section>
              {!practice && (
                <HistoryRegister
                  {...historyProps}
                  key={`audit:${member.organizationId}:${branchId}`}
                  title="Audit register"
                  kind="audit"
                  emptyTitle="No audit events recorded"
                  columns={[
                    { label: "Event ID", value: (r) => r.id },
                    { label: "Action", value: (r) => r.action },
                    {
                      label: "Branch",
                      value: (r) =>
                        r.branch_id ? branchName(r.branch_id) : "Business",
                    },
                    { label: "Actor ID", value: (r) => r.actor_id },
                    { label: "Source ID", value: (r) => r.source_id },
                    {
                      label: "Details",
                      value: (r) => JSON.stringify(r.details),
                    },
                    { label: "Recorded at", value: (r) => r.created_at },
                  ]}
                >
                  {(records) =>
                    table(
                      ["Recorded", "Action", "Scope", "Reference", "Details"],
                      records.map((r) => (
                        <tr key={str(r, "id")}>
                          <td>{when(r.created_at)}</td>
                          <td>{str(r, "action").replaceAll("_", " ")}</td>
                          <td>
                            {r.branch_id ? branchName(r.branch_id) : "Business"}
                          </td>
                          <td>
                            {str(r, "source_id").slice(0, 8) || "—"}
                            <small>Event {str(r, "id")}</small>
                          </td>
                          <td>
                            <details>
                              <summary>View details</summary>
                              <pre className="history-details">
                                {JSON.stringify(r.details, null, 2)}
                              </pre>
                            </details>
                          </td>
                        </tr>
                      )),
                      "audit",
                    )
                  }
                </HistoryRegister>
              )}
            </details></>
          )}

          {view === "inventory" && (
            <>{inventoryTab!=="products"&&inventoryTabs}<div hidden={inventoryTab!=="products"}>
              <InventoryWorkspace tabs={inventoryTabs} products={products} stock={stock} onControls={()=>setInventoryTab("controls")} onExpiry={()=>setInventoryTab("expiry")} onAdd={()=>setInventoryTab("setup")} onReceive={receiveInventory} onEdit={product=>openInventoryReview(product,true)} onEditCatalog={()=>openInventoryReview(undefined,true)} onPrices={()=>setInventoryTab("prices")} onReview={()=>openInventoryReview()} canManage={isOwner&&!practice}/></div>
              {!practice && member.role !== "cashier" && <div hidden={inventoryTab!=="controls"&&inventoryTab!=="expiry"}><StockControls focus={inventoryTab==="expiry"?"expiry":"all"} key={`${member.organizationId}:${branchId}`} db={db} organizationId={member.organizationId} branchId={branchId} actorId={member.userId} products={products} owner={isOwner} canAssign={isOwner || member.role === "manager"} online={online} disabled={busy} revision={historyRevision} execute={fn => run(fn,true,true)} /></div>}
              {isOwner && (
                <div hidden={inventoryTab!=="setup"&&inventoryTab!=="review"}>
                  {!practice&&<div hidden={inventoryTab!=="review"}><ImportedProductReview key={`review:${branchId}:${inventoryReviewEntry.serial}`} initialProductId={inventoryReviewEntry.productId} showCatalog={inventoryReviewEntry.showCatalog} stock={stock} products={products} organizationId={member.organizationId} branchId={branchId} disabled={busy||!online} onSave={async (action,data)=>{const problem=await run(async()=>{await onlineOperation(db,member.userId,action,{...context(),...data},"requestId");},true,true);if(problem)throw problem;}}/></div>}
                  <section className="panel" hidden={inventoryTab!=="setup"}>
                    <Button variant="ghost" onClick={()=>setInventoryTab("products")}>Back to products</Button><h2>Add a product</h2>
                    <p className="muted">
                      Choose pack, weight, volume, length or piece selling. Each enabled selling
                      unit has its own price; loose selling is optional.
                    </p>
                    <ProductSetupForm
                      disabled={busy || !online || practice}
                      onSave={(product) =>
                        run(async () => {
                          if (practice)
                            throw new Error(
                              "Catalog changes require signing in to your business.",
                            );
                          await command("create_product", {
                            ...context(),
                            ...product,
                          });
                          notify(
                            "Product added with its configured selling units and prices.",
                          );
                        }, true, true)
                      }
                    />
                  </section>

                </div>
              )}
            {practice&&(inventoryTab==="expiry"||inventoryTab==="controls"||inventoryTab==="prices")&&<section className="panel"><h2>{inventoryTab==="expiry"?"Expiry reminders":inventoryTab==="controls"?"Stock controls":"Price history"}</h2><p>Practice checkout does not load business holds, investigations or historical price records. Sign in to inspect those records. This sample catalog and its local stock remain separate from your business.</p><Button variant="outline" onClick={()=>setInventoryTab("products")}>Return to products</Button></section>}{isOwner&&!practice&&inventoryTab==="prices"&&<PriceHistory key={`${member.organizationId}:${branchId}`} organizationId={member.organizationId} branchId={branchId} products={products} online={online} disabled={busy}/>}</>
          )}

          {view === "receiving" && (
            <><WorkspaceTabs label="Purchasing sections" value={["accounts","suppliers"].includes(purchasingTab)?purchasingTab:"deliveries"} onChange={id=>setPurchasingTab(id==="deliveries"?"orders":id)} tabs={[{id:"deliveries",label:"Orders & deliveries"},...(isOwner&&!practice?[{id:"accounts",label:"Supplier bills"}]:[]),{id:"suppliers",label:"Suppliers"}]}/>{!["accounts","suppliers"].includes(purchasingTab)&&<WorkspaceTabs label="Orders and receiving steps" value={purchasingTab} onChange={setPurchasingTab} tabs={[{id:"orders",label:"Orders"},{id:"inspections",label:"Inspect delivery"},{id:"quick",label:"Quick receipt"},{id:"history",label:"Receiving history"},...(isOwner?[{id:"opening",label:"Opening stock"}]:[])]}/>}{!practice&&isOwner&&purchasingTab==="accounts"&&<SupplierAccounts initialBillId={supplierBillTarget} onRecords={openRecords} key={`supplier-accounts:${member.organizationId}:${branchId}`} db={db} organizationId={member.organizationId} branchId={branchId} actorId={member.userId} online={online} disabled={busy} execute={fn=>run(fn,true,true)}/>}{practice&&purchasingTab==="orders"&&<div className="practice-purchasing"><Button className="practice-order-request" disabled title="Sign in to request a business purchase order"><Plus size={20}/>Request purchase order</Button><div className="workspace-stats three"><WorkspaceStat icon={ClipboardCheck} label="Awaiting approval" value="—"/><WorkspaceStat icon={Truck} label="Awaiting delivery" value="—"/><WorkspaceStat icon={Package} label="Supplier claims" value="—"/></div><OrderWorkspace orders={[]} products={products} disabled actions={()=>null} onInspect={()=>{}}/><p className="scope-note">Business purchasing requires signing in. Practice checkout does not create orders or stock.</p></div>}
              {!practice && member.role !== "cashier" && purchasingTab!=="accounts" && <PurchasingWorkspace onBillSaved={openSupplierBill} pane={purchasingTab} onPaneChange={setPurchasingTab} key={`purchasing:${member.organizationId}:${branchId}`} db={db} organizationId={member.organizationId} branchId={branchId} branchName={selectedBranch?.name ?? "Selected branch"} actorId={member.userId} products={products} suppliers={(cloud.suppliers ?? []).map(s => ({ id: str(s,"id"), name: str(s,"name") }))} role={member.role} online={online} disabled={busy} revision={historyRevision} reversalBlocked={allPendingCount > 0 || syncing || !!lease || cart.items.length > 0} execute={fn => run(fn,true,true)} />}
              <div className="two-column">
                <section className="panel" hidden={purchasingTab!=="quick"}>
                  <h2 id="quick-receipt-heading" ref={quickReceiptHeading} tabIndex={-1}>Quick receipt · saleable goods only</h2>
                  <p className="muted">
                    Record an unplanned, fully saleable receipt. For purchase orders, held or rejected goods, use Inspect supplier delivery above. Never record the same delivery in both forms.
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.currentTarget,
                        f = new FormData(form);
                      void run(async () => {
                        const p = products.find((p) =>
                          p.units.some((u) => u.id === inputValue(f, "unit")),
                        );
                        if (!p) throw new Error("Select a product");
                        const delivery={
                            ...context(),
                            reference: inputValue(f, "reference"),
                            source: "purchase",
                            supplierId: inputValue(f, "supplier") || null,
                            items: [
                              {
                                productId: p.id,
                                unitId: inputValue(f, "unit"),
                                quantity: inputValue(f, "quantity"),
                                documentQuantity: inputValue(f,"documentQuantity") || null,
                                deliveryNotes: inputValue(f,"deliveryNotes"),
                                lot: inputValue(f, "lot"),
                                expiresOn: inputValue(f, "expires") || null,
                              },
                            ],
                          };
                        const invoice=isOwner&&!practice?purchaseInvoice(f):null;
                        const result=await onlineOperation(db,member.userId,invoice?"supplier_receive_purchase":"receive_stock",invoice?{...context(),receiptAction:"receive_stock",delivery:{...delivery,receiptId:crypto.randomUUID()},invoice}:delivery,invoice?"requestId":"receiptId");
                        if(checkoutScopeGeneration!==contextGeneration.current)return;
                        if(invoice&&typeof result.billId==="string")openSupplierBill(result.billId);
                        form.reset();setQuickUnit("");setQuickSupplier("");
                        notify("Delivery recorded.");
                      }, true, true);
                    }}
                  >
                    <Field label="Supplier">
                      <SearchableSelect name="supplier" aria-label="Supplier" value={quickSupplier} onValueChange={setQuickSupplier}>
                        <option value="">No supplier selected</option>
                        {(cloud.suppliers ?? []).map((r) => (
                          <option key={str(r, "id")} value={str(r, "id")}>
                            {str(r, "name")}
                          </option>
                        ))}
                      </SearchableSelect>
                    </Field>
                    <Field label="Delivery / invoice reference">
                      <input name="reference" required />
                    </Field>
                    <Field label="Product and unit">
                      <SearchableSelect name="unit" aria-label="Product and unit" required value={quickSellingUnit?.id??""} onValueChange={value =>setQuickUnit(value)}>
                        {products.flatMap((p) =>
                          p.units.map((u) => (
                            <option key={u.id} value={u.id} data-search={`${p.sku} ${("originalCode" in p ? String(p.originalCode??"") : "")}`}>
                              {p.name} · {u.name}
                            </option>
                          )),
                        )}
                      </SearchableSelect>
                    </Field>
                    <MeasuredQuantity key={`quick:${branchId}:${quickSellingUnit?.id}`} label="Quantity received" name="quantity" measurement={{baseUnit:quickProduct?.baseUnit??"base units",unitName:quickSellingUnit?.name??"selected unit",factor:quickSellingUnit?.factor??"1"}} positive disabled={busy||!online||!quickSellingUnit}/>

                    <p className="muted">Enter only accepted, saleable goods above. Keep rejected or damaged goods separate.</p>
                    <MeasuredQuantity key={`document:${branchId}:${quickSellingUnit?.id}`} label="Quantity on supplier document (optional)" entryLabel="Quantity on supplier document" name="documentQuantity" measurement={{baseUnit:quickProduct?.baseUnit??"base units",unitName:quickSellingUnit?.name??"selected unit",factor:quickSellingUnit?.factor??"1"}} required={false} disabled={busy||!online||!quickSellingUnit}/>
                    <Field label="Delivery shortage / rejection notes"><input name="deliveryNotes" maxLength={1000} placeholder="Required when accepted goods differ from the supplier document" /></Field>
                    <div className="form-grid">
                      <Field label="Lot / batch">
                        <input name="lot" />
                      </Field>
                      <Field label="Expiry date">
                        <input name="expires" type="date" />
                      </Field>
                    </div>
                    {isOwner&&!practice&&<SupplierPurchaseFields key={`${branchId}:${quickSupplier}:${historyRevision}`} organizationId={member.organizationId} branchId={branchId} supplierId={quickSupplier} disabled={busy||!online}/>}
                    <Button
                      disabled={
                        busy || !online || practice || !["owner", "manager"].includes(member.role)
                      }
                    >
                      Receive stock
                      <ArrowDownToLine size={16} />
                    </Button>
                  </form>
                </section>
                <div>
                  <section className="panel" hidden={purchasingTab!=="suppliers"}>
                    <h2 id="purchasing-suppliers">Suppliers</h2>
                    {(cloud.suppliers ?? []).length ? (
                      <ul className="plain-list">
                        {(cloud.suppliers ?? []).map((s) => (
                          <li key={str(s, "id")}>
                            <strong>{str(s, "name")}</strong>
                            <small>
                              {str(s, "contact") || "No contact details"}
                            </small>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted">No suppliers added yet.</p>
                    )}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const form = e.currentTarget;
                        const f = new FormData(form);
                        void run(async () => {
                          await command("create_supplier", {
                            ...context(),
                            name: inputValue(f, "name"),
                            contact: inputValue(f, "contact"),
                          });
                          form.reset();
                          notify("Supplier added.");
                        });
                      }}
                    >
                      <Field label="Supplier name">
                        <input name="name" required />
                      </Field>
                      <Field label="Contact details">
                        <input name="contact" />
                      </Field>
                      <Button
                        variant="outline"
                        disabled={
                          !online ||
                          busy ||
                          practice ||
                          !["owner", "manager"].includes(member.role)
                        }
                      >
                        Add supplier
                      </Button>
                    </form>
                  </section>
                  {isOwner && (
                    <section className="panel" hidden={purchasingTab!=="opening"}>
                      <h2>Import opening stock</h2>
                      <p className="muted">
                        CSV columns:{" "}
                        <code>sku,unit,quantity,lot,expiresOn</code>. Use one
                        branch’s verified opening count per file. Import once;
                        correct mistakes through approved counts.
                      </p>
                      <input
                        aria-label="Opening stock CSV"
                        type="file"
                        accept=".csv,text/csv"
                        disabled={!online || busy || practice}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          void run(async () => {
                            const { parseOpeningCSV } = await import(
                              "../lib/import"
                            );
                            const records = parseOpeningCSV(
                              await file.text(),
                              products,
                            );
                            setOpeningImport({
                              name: file.name,
                              branchId,
                              items: records,
                            });
                          });
                          e.currentTarget.value = "";
                        }}
                      />
                      {openingImport && openingImport.branchId === branchId && (
                        <form
                          className="spaced-form"
                          aria-label="Confirm opening stock"
                          onSubmit={(e) => {
                            e.preventDefault();
                            void run(async () => {
                              await onlineOperation(
                                db,
                                member.userId,
                                "receive_stock",
                                {
                                  ...context(),
                                  source: "opening",
                                  reference: openingImport.name,
                                  items: openingImport.items,
                                },
                                "receiptId",
                              );
                              setOpeningImport(undefined);
                              notify(
                                "Opening stock imported. Verify the Inventory totals before selling.",
                              );
                            }, true, true);
                          }}
                        >
                          <p>
                            {openingImport.name}: {openingImport.items.length}{" "}
                            opening-stock lines for {selectedBranch?.name}.
                          </p>
                          <label className="checkbox">
                            <input type="checkbox" required />I verified this
                            branch’s physical opening count.
                          </label>
                          <Button disabled={!online || busy || practice}>
                            Confirm opening stock import
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => setOpeningImport(undefined)}
                          >
                            Cancel import
                          </Button>
                        </form>
                      )}
                    </section>
                  )}
                </div>
              </div>
              {!practice && (
                <div hidden={purchasingTab!=="history"}><HistoryRegister
                  {...historyProps}
                  key={`purchases:${member.organizationId}:${branchId}`}
                  title="Receiving history"
                  kind="purchases"
                  emptyTitle="No receiving records yet"
                  columns={[
                    { label: "ID", value: (r) => r.id },
                    { label: "Reference", value: (r) => r.reference },
                    { label: "Source", value: (r) => r.source },
                    { label: "Supplier ID", value: (r) => r.supplier_id },
                    { label: "Recorded at", value: (r) => r.created_at },
                  ]}
                >
                  {(records) =>
                    table(
                      ["Recorded", "Reference", "Source", "Supplier", "Lines"],
                      records.map((r) => (
                        <tr key={str(r, "id")}>
                          <td>{when(r.created_at)}</td>
                          <td>
                            <strong>{str(r, "reference")}</strong>
                            <small>{str(r, "id").slice(0, 8)}</small>
                          </td>
                          <td>
                            {str(r, "source") === "opening"
                              ? "Opening stock"
                              : "Purchase"}
                          </td>
                          <td>
                            {r.supplier_id
                              ? str(
                                  (cloud.suppliers ?? []).find(
                                    (s) => s.id === r.supplier_id,
                                  ) ?? r,
                                  "name",
                                ) || str(r, "supplier_id")
                              : "No supplier"}
                          </td>
                          <td>
                            {Array.isArray(
                              (r.payload as { items?: unknown[] })?.items,
                            )
                              ? (r.payload as { items: unknown[] }).items.length
                              : "—"}
                          </td>
                        </tr>
                      )),
                      "purchases",
                    )
                  }
                </HistoryRegister></div>
              )}
            </>
          )}

          {view === "transfers" && (
            <>
              {!practice && (
                <HistoryRegister
                  {...historyProps}
                  key={`transfers:${member.organizationId}:${branchId}`}
                  title="Transfer register"
                  kind="transfers"
                  emptyTitle="No transfers yet"
                  columns={[
                    { label: "ID", value: (r) => r.id },
                    ...stockHistoryColumns(products),
                    { label: "From", value: (r) => branchName(r.branch_id) },
                    {
                      label: "To",
                      value: (r) => branchName(r.destination_branch_id),
                    },
                    { label: "Base quantity", numeric: true, value: (r) => r.quantity },
                    { label: "State", value: (r) => r.state },
                    { label: "Dispatched at", value: (r) => r.dispatched_at },
                    { label: "Received at", value: (r) => r.received_at },
                  ]}
                >
                  {(records) =>
                    table(
                      [
                        "Product / lot",
                        "From → to",
                        "Base quantity",
                        "Status",
                        "Action",
                      ],
                      records.map((t) => (
                        <tr key={str(t, "id")}>
                          <td>{stockLabel(t)}</td>
                          <td>
                            {branchName(t.branch_id)} →{" "}
                            {branchName(t.destination_branch_id)}
                          </td>
                          <td>{stockQuantity(t, str(t, "quantity"))}<small>Accepted: {str(t,"received_quantity") || "0"} · Held: {str(t,"held_quantity") || "0"} · Lost: {str(t,"lost_quantity") || "0"}<br />Outstanding: {outstandingTransfer(t)}</small></td>
                          <td>
                            <span className="status-tag">
                              {str(t, "state").replaceAll("_", " ")}
                            </span>
                          </td>
                          <td>
                            {t.state === "in_transit" &&
                              t.destination_branch_id === branchId && (
                                <ApprovalForm
                                  action="Confirm receipt"
                                  label="Receiving notes"
                                  description={`Outstanding: ${outstandingTransfer(t)} base units. Count what arrived. Enter saleable and held quantities separately; missing goods remain outstanding.`}
                                  confirmLabel="Record actual receipt"
                                  disabled={
                                    !online || busy || practice ||
                                    !["owner", "manager", "stock_staff"].includes(member.role)
                                  }
                                  onConfirm={(reason,f) =>
                                    run(async () => {
                                      await onlineOperation(db,member.userId,"receive_transfer", {
                                        ...context(),
                                        transferId: t.id,
                                        quantity: inputValue(f,"quantity"), heldQuantity: inputValue(f,"heldQuantity"), reason,
                                      },"receiptId");
                                      notify("Actual transfer quantities recorded. Any shortage remains open.");
                                    },true,true)
                                  }
                                >
                                  <MeasuredQuantity label="Saleable quantity actually received (base units)" entryLabel="Saleable quantity actually received" name="quantity" measurement={{baseUnit:historicalStock(products,t).baseUnit||"base units",unitName:historicalStock(products,t).baseUnit||"base units",factor:"1"}} max={outstandingTransfer(t)}/>
                                  <MeasuredQuantity label="Damaged / held quantity received (base units)" entryLabel="Damaged / held quantity received" name="heldQuantity" measurement={{baseUnit:historicalStock(products,t).baseUnit||"base units",unitName:historicalStock(products,t).baseUnit||"base units",factor:"1"}} initial="0" max={outstandingTransfer(t)}/>
                                </ApprovalForm>
                              )}
                            {isOwner && t.state === "in_transit" && t.destination_branch_id === branchId && <ApprovalForm action="Record missing transfer goods" label="Investigation evidence / loss reason" description={`This closes an investigated shortage from the outstanding ${outstandingTransfer(t)} base units. It does not deduct the source stock again or add destination stock.`} confirmLabel="Record transfer loss" disabled={!online || busy || practice} onConfirm={(reason,f) => run(async () => {
                              await onlineOperation(db,member.userId,"write_off_transfer",{...context(),transferId:t.id,quantity:inputValue(f,"missingQuantity"),reason},"receiptId");
                              notify("Missing transfer goods recorded separately. Review and resolve the investigation in Inventory.");
                            },true,true)}><MeasuredQuantity label="Missing transfer quantity (base units)" entryLabel="Missing transfer quantity" name="missingQuantity" measurement={{baseUnit:historicalStock(products,t).baseUnit||"base units",unitName:historicalStock(products,t).baseUnit||"base units",factor:"1"}} positive max={outstandingTransfer(t)}/></ApprovalForm>}
                          </td>
                        </tr>
                      )),
                      "transfers",
                    )
                  }
                </HistoryRegister>
              )}
              <section className="panel narrow-panel">
                <h2>Dispatch a transfer</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const f = new FormData(form);
                    const [productId, batchId] = inputValue(f, "stock").split(
                      ":",
                    );
                    void run(async () => {
                      await onlineOperation(
                        db,
                        member.userId,
                        "dispatch_transfer",
                        {
                          ...context(),
                          productId,
                          batchId: batchId === "none" ? null : batchId,
                          quantity: inputValue(f, "quantity"),
                          destinationBranchId: inputValue(f, "destination"),
                        },
                        "transferId",
                      );
                      form.reset();setDispatchStock("");
                      if (lease) await sync();
                      notify(
                        "Stock dispatched. It remains in transit until received.",
                      );
                    });
                  }}
                >
                  <StockSelect products={products} value={dispatchSelection} onChange={setDispatchStock}/>
                  <Field label="Destination branch">
                    <select name="destination" aria-label="Destination branch" required>
                      {branchList
                        .filter((b) => b.id !== branchId)
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <MeasuredQuantity key={`dispatch:${branchId}:${dispatchSelection}`} label="Quantity in base units (kg / liter / meter / piece)" entryLabel="Dispatch quantity" name="quantity" measurement={{baseUnit:dispatchProduct?.baseUnit??"base units",unitName:dispatchProduct?.baseUnit??"base units",factor:"1"}} positive disabled={busy||!online||!dispatchProduct}/>

                  <Button
                    disabled={
                      !online ||
                      busy ||
                      practice ||
                      !["owner", "manager"].includes(member.role) ||
                      !!pending.length
                    }
                  >
                    Dispatch stock
                    <ArrowRight size={16} />
                  </Button>
                </form>
              </section>
            </>
          )}

          {view === "counts" && <>{inventoryTabs}</>}
          {view === "counts" && (
            practice ? <section className="panel"><h2>Blind stock counts</h2><p>Use the connected staging business with separate staff accounts to rehearse blind counts and owner approval. Practice mode never changes server stock.</p></section> : member.role === "cashier" ? <section className="panel"><h2>Stock counts</h2><p>Stock counts require a stock-staff, manager or owner account. Cashiers cannot submit or approve adjustments.</p></section> :
            <BlindCounts key={`${member.organizationId}:${branchId}:${member.userId}`} db={db} organizationId={member.organizationId} branchId={branchId} actorId={member.userId} products={products.filter(p=>!p.setupPending)} owner={isOwner} online={online} disabled={busy || !!pending.length} revision={historyRevision} execute={fn => run(fn,true,true)}>
              {!practice && (
                <HistoryRegister
                  {...historyProps}
                  key={`counts:${member.organizationId}:${branchId}`}
                  title="Count register"
                  kind="counts"
                  emptyTitle="No counts recorded"
                  columns={[
                    { label: "ID", value: (r) => r.id },
                    ...stockHistoryColumns(products),
                    { label: "Expected", numeric: true, value: (r) => r.expected },
                    { label: "Counted", numeric: true, value: (r) => r.counted },
                    {
                      label: "Difference",
                      numeric: true,
                      value: (r) =>
                        new Decimal(str(r, "counted"))
                          .minus(str(r, "expected"))
                          .toFixed(),
                    },
                    { label: "State", value: (r) => r.state },
                    { label: "Reason", value: (r) => r.reason },
                    { label: "Recorded at", value: (r) => r.created_at },
                  ]}
                >
                  {(records) =>
                    table(
                      [
                        "Product / lot",
                        "Expected",
                        "Counted",
                        "Difference",
                        "Status",
                        "Action",
                      ],
                      records.map((c) => (
                        <tr key={str(c, "id")}>
                          <td>
                            {stockLabel(c)}
                            <small>Reason: {str(c, "reason")}</small>
                          </td>
                          <td>{stockQuantity(c, str(c, "expected"))}</td>
                          <td>{stockQuantity(c, str(c, "counted"))}</td>
                          <td>
                            {stockQuantity(
                              c,
                              new Decimal(str(c, "counted"))
                                .minus(str(c, "expected"))
                                .toFixed(),
                            )}
                          </td>
                          <td>{str(c, "state")}</td>
                          <td>
                            <span>{c.count_method === 'blind_v1' ? 'Review the matching blind count above.' : c.state === 'pending' ? 'Legacy count: start a fresh blind count before any adjustment.' : 'Historical record retained.'}</span>
                          </td>
                        </tr>
                      )),
                      "counts",
                    )
                  }
                </HistoryRegister>
              )}
            </BlindCounts>
          )}

          {view === "sales" && (
            <section className="sales-page">
              {(practice?!sales.length:!branchSales.length)&&pageHeading}
              <h2 className="sr-only">{selectedBranch?.name} · cash sales</h2>
              {practice ? (
                sales.length ? (
                  table(
                    [
                      "Local record",
                      "Amount",
                      "Cash received",
                      "Change",
                      "Saved",
                    ],
                    sales.map((s) => (
                      <tr key={s.id}>
                        <td>
                          {s.id.slice(0, 8)}
                          <small>Practice sale</small>
                        </td>
                        <td><strong>{money(s.payload.total)}</strong></td>
                        <td>{money(s.payload.cashReceived)}</td>
                        <td>
                          {money(s.payload.cashReceived - s.payload.total)}
                        </td>
                        <td>{when(s.payload.occurredAt)}</td>
                      </tr>
                    )),
                  )
                ) : (
                  <Empty
                    icon={FileText}
                    title="Your first receipt is waiting"
                    body="Complete a practice checkout to see its saved record here."
                  />
                )
              ) : branchSales.length ? (
                table(
                  ["Receipt", "Amount", "Cash received", "Date", "Correction"],
                  [...branchSales]
                    .sort((a, b) =>
                      str(b, "occurred_at").localeCompare(
                        str(a, "occurred_at"),
                      ),
                    )
                    .map((s) => (
                      <tr key={str(s, "id")}>
                        <td>
                          <strong>{str(s, "receipt")}</strong>
                          <small>{str(s, "id").slice(0, 8)}</small>
                        </td>
                        <td>{money((s.total) as number|string)}</td>
                        <td>{money((s.cash_received) as number|string)}</td>
                        <td>{when(s.occurred_at)}</td>
                        <td>
                          {s.payment_mode === "credit" ? <Button variant="outline" size="sm" onClick={()=>setView("credit")}>Open credit account</Button> : s.sale_reversals &&
                          (!Array.isArray(s.sale_reversals) ||
                            s.sale_reversals.length > 0) ? (
                            <><span className="status-tag">{Array.isArray(s.sale_refund_corrections)&&s.sale_refund_corrections.length>0?"Refund corrected · check details":"Refunded"}</span>{isOwner&&<Button size="sm" variant="outline" disabled={!online||busy} onClick={()=>setPartialRefundSaleId(String(s.id))}>Refund details</Button>}</>
                          ) : (
                            <>
                            {Array.isArray(s.sale_partial_refunds)&&s.sale_partial_refunds.length>0&&<p className="status-tag">Refund recorded · check details</p>}
                            {isOwner&&<Button size="sm" variant="outline" disabled={!online||busy} onClick={()=>setPartialRefundSaleId(String(s.id))}>Return / refund items</Button>}{isOwner&&(!lease||allPendingCount>0||operations.length>0||syncing||cart.items.length>0)&&<p className="refund-entry-help">{!lease?'Open your own cashier shift before confirming a return.':'Finish the basket and confirm pending records before returning items.'}{!lease&&<Button variant="ghost" size="sm" onClick={()=>setView('pos')}>Open cashier shift</Button>}</p>}
                            {isOwner && (!Array.isArray(s.sale_partial_refunds)||s.sale_partial_refunds.length===0) && (!Array.isArray(s.sale_refund_corrections)||s.sale_refund_corrections.length===0) && (
                              <ApprovalForm
                                action="Full refund"
                                label="Refund reason"
                                description={`Refund ${money((s.total) as number|string)} in cash. Record what physically returned for each line; only inspected saleable goods increase available stock. The original receipt is preserved.`}
                                confirmLabel="Confirm full refund"
                                disabled={
                                  !online || busy || !lease || allPendingCount>0 || operations.length>0 || syncing || cart.items.length>0
                                }
                                onConfirm={(reason,f) =>
                                  run(async () => {
                                    await onlineOperation(
                                      db,
                                      member.userId,
                                      "refund_sale",
                                      {
                                        ...context(),
                                        saleId: s.id,
                                        shiftId: lease?.shiftId,
                                        reason,
                                        returns: ((s.payload as Sale)?.items ?? []).map((_,lineIndex) => ({lineIndex,quantity:inputValue(f,`returned-${lineIndex}`),disposition:inputValue(f,`disposition-${lineIndex}`),...(inputValue(f,`disposition-${lineIndex}`)==='mixed' ? {resalableQuantity:inputValue(f,`resalable-${lineIndex}`)} : {})})),
                                      },
                                      "refundId",
                                    );
                                    await sync();
                                    notify(
                                      "Refund recorded as a linked reversal. Original sale retained.",
                                    );
                                  })
                                }
                              >
                                {((s.payload as Sale)?.items ?? []).map((item,lineIndex) => <div key={lineIndex}>
                                  <p>{item.name} · sold {item.quantity} {item.unitName}</p>
                                  <MeasuredQuantity label={`Returned quantity for line ${lineIndex+1} (${item.unitName})`} entryLabel={`Returned quantity for line ${lineIndex+1}`} name={`returned-${lineIndex}`} measurement={{baseUnit:products.find(p=>p.id===item.productId)?.baseUnit??"base units",unitName:item.unitName,factor:item.factor}} max={item.quantity}/>
                                  <Field label={`Disposition for return line ${lineIndex+1}`}><select aria-label={`Disposition for return line ${lineIndex+1}`} name={`disposition-${lineIndex}`} defaultValue="hold"><option value="hold">Hold separately for inspection</option><option value="resalable">Inspected and saleable</option><option value="mixed">Split between saleable and held goods</option><option value="not_returned">No goods returned (quantity zero)</option></select></Field>
                                  <MeasuredQuantity label={`Saleable portion for mixed return line ${lineIndex+1} (${item.unitName})`} entryLabel={`Saleable portion for mixed return line ${lineIndex+1}`} name={`resalable-${lineIndex}`} measurement={{baseUnit:products.find(p=>p.id===item.productId)?.baseUnit??"base units",unitName:item.unitName,factor:item.factor}} max={item.quantity} required={false}/><small>For a split return only. The rest of the returned quantity stays on hold.</small>
                                </div>)}
                              </ApprovalForm>
                            )}
                            </>
                          )}
                        </td>
                      </tr>
                    )),
                )
              ) : (
                <Empty
                  icon={FileText}
                  title="No confirmed sales yet"
                  body="Sales appear here after synchronization. Pending local records remain in the Sync center."
                />
              )}
              {!practice&&isOwner&&partialRefundSaleId&&branchSales.some(s=>s.id===partialRefundSaleId)&&<section className="refund-detail" aria-label="Selected sale partial refund">
                <h3>Refund quantities and corrections</h3><p>Receipt: {String(branchSales.find(s=>s.id===partialRefundSaleId)?.receipt)}</p>
                <Button size="sm" variant="ghost" disabled={busy} onClick={()=>setPartialRefundSaleId(undefined)}>Close refund details</Button>
                <PartialRefundControl key={`partial:${member.organizationId}:${branchId}:${partialRefundSaleId}`} db={db} organizationId={member.organizationId} branchId={branchId} saleId={partialRefundSaleId} actorId={member.userId} shiftId={lease?.shiftId} readDisabled={!online||busy} disabled={!online||busy||!lease||allPendingCount>0||syncing||cart.items.length>0} execute={fn=>run(fn,true,true)}/>
              </section>}
              {!practice && branchSales.length > 0 && (
                <div className="section-heading">
                  <p className="muted" role="status">
                    {branchSales.length} receipts loaded for{" "}
                    {selectedBranch?.name}.{" "}
                    {salesCursor
                      ? "Older receipts are available."
                      : "End of receipt history."}
                  </p>
                  {salesCursor && (
                    <Button
                      variant="outline"
                      disabled={!online || busy}
                      onClick={() => {
                        const before = salesCursor;
                        void run(async () => {
                          const generation = contextGeneration.current;
                          const request = ++cloudRequest.current;
                          const page = await salesPage(
                            member.organizationId,
                            branchId,
                            before,
                          );
                          if (
                            generation !== contextGeneration.current ||
                            request !== cloudRequest.current
                          )
                            return;
                          setCloud((current) => ({
                            ...current,
                            sales: [
                              ...new Map(
                                [...(current.sales ?? []), ...page.rows].map(
                                  (row) => [String(row.id), row],
                                ),
                              ).values(),
                            ],
                          }));
                          setSalesCursor(page.next);
                        }, false);
                      }}
                    >
                      Load older receipts
                    </Button>
                  )}
                </div>
              )}
            </section>
          )}

          {view === "sync" && (
            <>
              <div className="sync-overview"><div className="sync-summary">
                <div className="sync-illustration">
                  {online ? <RefreshCw size={32} /> : <CloudOff size={32} />}
                </div>
                <div>
                  <h2>
                    {!branchId
                      ? "Reconnect to identify the saved branch"
                      : practice
                      ? "Practice records stay on this PC"
                      : branchPendingCount || branchOperationCount
                        ? `${branchPendingCount} sales and ${branchOperationCount} requests awaiting confirmation`
                        : "Your local queue is clear"}
                  </h2>
                  <p>
                    {!branchId
                      ? "Saved records remain on this PC. Reconnect to load your permitted branch before reviewing its queue. Do not repeat saved purchases or clear site data."
                      : practice
                      ? "Practice mode never connects its transactions to your live business."
                      : `Last successful synchronization: ${when(lastSync)}`}
                  </p>
                </div>
                <Button
                  variant="outline"
                  disabled={!online || syncing || practice}
                  onClick={() => void sync()}
                >
                  <RefreshCw size={16} className={syncing ? "spinning" : ""} />
                  {syncing ? "Synchronizing…" : "Sync now"}
                </Button>
              </div><div className="workspace-stats three queue-stats"><div className="workspace-stat"><div><span>Waiting to upload</span><strong>{branchPendingCount}</strong></div></div><div className="workspace-stat"><div><span>Needs attention</span><strong>{sales.filter(s=>s.status!=="synced"&&s.status!=="pending"&&s.status!=="sending").length}</strong></div></div><div className="workspace-stat"><div><span>Confirmed loaded</span><strong>{sales.filter(s=>s.status==="synced").length}</strong></div></div></div></div>
              <section className="panel queue-panel">
                <h2>Saved transaction queue</h2>{sales.length>0&&!visibleQueue.length&&<div className="notice" role="status"><p>No transactions match these filters. Saved records remain on this PC.</p><Button variant="outline" onClick={()=>{setSyncQuery("");setSyncFilter("all");}}>Clear transaction filters</Button></div>}<div className="queue-filters"><WorkspaceTabs label="Saved transaction filters" value={syncFilter} onChange={setSyncFilter} tabs={[{id:"all",label:"All records"},{id:"pending",label:"Pending"},{id:"attention",label:"Needs attention"},{id:"synced",label:"Synced"}]}/><label className="field"><span className="sr-only">Search transaction</span><input type="search" aria-label="Search transaction" placeholder="Search transaction ID or receipt" value={syncQuery} onChange={e=>setSyncQuery(e.target.value)}/></label></div>
                {sales.length ? (
                  table(
                    ["Transaction", "Saved at", "Amount", "Status", "Details", "Recovery"],
                    visibleQueue.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <details className="queue-identity"><summary>{s.receipt ?? s.id.slice(0, 8)}</summary><small>Original transaction ID</small><code>{s.id}</code></details>
                        </td><td>{when(s.payload.occurredAt)}
                        </td>
                        <td>{money(s.payload.total)}</td>
                        <td>
                          <StateBadge kind={practice?"local":s.status==="synced"?"confirmed":s.status==="pending"||s.status==="sending"?"pending":s.status==="authentication_required"?"locked":"warning"}>{practice?"Practice · local":s.status.replaceAll("_"," ")}</StateBadge>
                        </td>
                        <td>
                          {s.error ?? s.flags?.join(", ") ?? "Saved locally"}
                        </td>
                        <td>
                          {s.status !== "synced" && !practice && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={
                                !online ||
                                busy ||
                                s.payload.cashierId !== member.userId
                              }
                              onClick={() =>
                                void run(async () => {
                                  await retrySale(db, s.id);
                                  await sync();
                                })
                              }
                            >
                              Retry original sale
                            </Button>
                          )}
                          {isOwner && !practice && s.status !== "synced" && (
                            <ApprovalForm
                              action="Approve recovery"
                              label="Recovery approval reason"
                              description="Verify the original receipt before approving this saved sale. The original cashier and transaction ID remain unchanged."
                              confirmLabel="Confirm recovery"
                              disabled={!online || busy}
                              onConfirm={(reason) =>
                                run(async () => {
                                  const ack = await command<{
                                    status: string;
                                    receipt?: string;
                                    flags?: string[];
                                    reason?: string;
                                  }>("recover_sale", {
                                    ...context(),
                                    sale: s.payload,
                                    reason,
                                  });
                                  if (ack.status === "review")
                                    throw new Error(
                                      ack.reason ?? "Recovery needs review",
                                    );
                                  await db.sales.update(s.id, {
                                    status: "sending",
                                    receipt: ack.receipt,
                                    flags: ack.flags,
                                    error: undefined,
                                  });
                                  notify(
                                    "Recovered sale approved. Original cashier, sale, and owner approval are preserved.",
                                  );
                                }, true, true)
                              }
                            />
                          )}
                        </td>
                      </tr>
                    )),
                  )
                ) : (
                  <><Empty
                    icon={RefreshCw}
                    title={branchId ? "No local transactions yet" : "Saved branch is not identified"}
                    body={branchId ? "Every completed checkout remains listed here, including failed uploads." : "Reconnect to identify this account’s downloaded branch. Existing records are retained; this empty view does not mean the PC has no saved sales."}
                  /><RecordPages label="Saved transactions">{[]}</RecordPages></>
                )}
                <details className="queue-scope"><summary>Loaded history scope</summary><p>All unresolved sales and up to {localHistoryLimit} recent saved records are available in pages of 10. Earlier confirmed history remains retained.</p></details>
                {hasOlderLocal && localHistoryLimit < 10000 && <Button variant="outline" onClick={() => setLocalHistoryLimit(n => Math.min(10000,n + 50))}>Load older saved records</Button>}
              </section>
              {operations.length > 0 && (
                <section className="panel">
                  <h2>Online operations awaiting confirmation</h2>
                  <RecordPages label="Saved records">{operations.map((op) => (
                    <div className="pending-operation" key={op.key}>
                      <div>
                        <strong>{op.action.replaceAll("_", " ")}</strong>
                        <p>
                          {op.error ?? "Original request retained on this PC"}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        disabled={
                          !online || busy || op.actorId !== member.userId
                        }
                        onClick={() =>
                          void run(async () => {
                            const result = await retryOperation(db, member.userId, op);
                            if (op.action === "close_shift") {
                              setLease(await setting<Lease>(db, "lease"));
                              notify(`Original shift closing confirmed. Expected cash ${money((((result.exactTotals??{}) as Row).expected_cash??result.expected_cash) as number|string)}; counted ${money((((result.exactTotals??{}) as Row).counted_cash??result.counted_cash) as number|string)}.`);
                            } else if(op.action==='record_online_sale'){
                              const saved=await db.sales.get(String(op.data.transactionId));
                              if(!saved)throw new Error('Check the original receipt in Sales & receipts before starting another sale.');
                              if(!useCart.getState().items.length||useCart.getState().attemptId===saved.id){cart.clear();setCash('');setCheckoutDone(saved);}
                              notify('Original cash sale confirmed. Do not collect its payment again. Open Checkout to print the saved receipt.');
                            } else notify("Original operation confirmed.");
                          })
                        }
                      >
                        Retry original request
                      </Button>
                    </div>
                  ))}</RecordPages>
                </section>
              )}
              <div className="recovery-actions"><section className="panel recovery-restore"><span className="recovery-icon"><FileUp size={30}/></span><div className="recovery-copy"><h2>Restore a recovery file</h2><p>Load a previously exported transaction file.</p></div><Button type="button" variant="outline" disabled={busy||!online} onClick={()=>recoveryFileInput.current?.click()}>Restore file</Button>
                <label className="sr-only">Select recovery file<input tabIndex={-1} ref={recoveryFileInput}
                    type="file"
                    accept="application/json,.json"
                    disabled={busy || !online}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setRecoverySelected(file.name);
                      setEncryptedRecoveryPending(undefined);
                      e.currentTarget.value = "";
                      void run(async () => {
                        if(file.size>96*1024*1024)throw new Error("This file exceeds the safe recovery size. Keep every original part and ask your owner for help.");
                        const input:unknown=JSON.parse(await file.text());
                        if(isEncryptedRecoveryBackup(input)){
                          setEncryptedRecoveryPending({name:file.name,payload:input});
                          setEncryptedRecoveryPassphrase("");
                          notify("Encrypted recovery selected. Enter its passphrase below before any transactions are restored.");
                          return;
                        }
                        if(file.size>64*1024*1024)throw new Error("This unencrypted recovery file exceeds 64 MB. Use the original bounded parts.");
                        await restoreRecoveryInput(input);
                      });
                    }}
                  />
                </label>{recoverySelected&&<p role="status" className="recovery-selected">Selected file: {recoverySelected}</p>}
                {encryptedRecoveryPending&&<form aria-label="Unlock encrypted recovery" className="secure-recovery-form" onSubmit={e=>{
                  e.preventDefault();const passphrase=encryptedRecoveryPassphrase;setEncryptedRecoveryPassphrase("");
                  const selected=encryptedRecoveryPending;
                  void run(async()=>{const data=await decryptRecoveryBackup(selected.payload,passphrase);await restoreRecoveryInput(data);setEncryptedRecoveryPending(undefined);});
                }}>
                  <p role="status">Encrypted file: {encryptedRecoveryPending.name}. Enter its original passphrase. A wrong passphrase restores nothing.</p>
                  <label className="field"><span>Backup passphrase</span><input type="password" autoComplete="off" required minLength={12} maxLength={1024} value={encryptedRecoveryPassphrase} onChange={e=>setEncryptedRecoveryPassphrase(e.target.value)}/></label>
                  <div className="button-row"><Button disabled={busy||!online}>Unlock and verify recovery</Button><Button type="button" variant="ghost" disabled={busy} onClick={()=>{setEncryptedRecoveryPending(undefined);setEncryptedRecoveryPassphrase("");}}>Cancel</Button></div>
                </form>}</section><section className="panel recovery-export"><span className="recovery-icon"><FileDown size={30}/></span><div className="recovery-copy"><h2>Export recovery file</h2><p>Create a file of saved transaction records for safekeeping.</p></div>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void run(exportLocalRecovery, false)}
                >
                  <span className="sr-only">{currentRecoveryArchive ? `Export recovery part ${currentRecoveryArchive.next} of ${currentRecoveryArchive.parts}` : "Export recovery file"}</span><span aria-hidden="true">Export file</span>
                </Button>
                <details className="secure-recovery-option"><summary>Export an encrypted copy (optional)</summary>
                  <p>Use a unique passphrase of at least 12 characters. Save it in your password manager. If you lose it, no one can unlock that encrypted file. Use the same passphrase for every part of this backup.</p>
                  <form className="secure-recovery-form" aria-label="Export encrypted recovery" onSubmit={e=>{
                    e.preventDefault();
                    if(secureExportPassphrase!==secureExportConfirmation){fail(new Error("Backup passphrases do not match."));return;}
                    const passphrase=secureExportPassphrase;setSecureExportPassphrase("");setSecureExportConfirmation("");
                    void run(()=>exportLocalRecovery(passphrase),false);
                  }}>
                    <label className="field"><span>Choose backup passphrase</span><input type="password" autoComplete="new-password" minLength={12} maxLength={1024} required value={secureExportPassphrase} onChange={e=>setSecureExportPassphrase(e.target.value)}/></label>
                    <label className="field"><span>Confirm backup passphrase</span><input type="password" autoComplete="new-password" minLength={12} maxLength={1024} required value={secureExportConfirmation} onChange={e=>setSecureExportConfirmation(e.target.value)}/></label>
                    <Button disabled={busy}>Download encrypted recovery part</Button>
                  </form>
                </details>
                {recoveryDownloadNotice()}</section>
                <details className="recovery-privacy"><summary>Recovery files contain transaction records. Keep them private.</summary><p>
                  Contains transaction records. Keep this file private. Pending
                  sales are retained when you sign out. Operation-only files can
                  be restored while shifts stay closed. Sale files require an
                  authorized cashier shift.
                </p></details>
              </div>
            </>
          )}

          {view === "close-shift" && (
            <section className="panel close-shift-panel" aria-label="Close cashier shift">
              {lease ? <>
                <h2>{selectedBranch?.name} · {lease.name}</h2>
                <ol className="shift-close-steps">
                  <li><strong>Finish saved work</strong>
                    {heldDraftCount>0&&<p className="notice">A held draft remains on this PC. Return to Checkout to resume or remove it before closing.</p>}{cart.items.length > 0 ? <><p>Your basket has {cart.items.length} unfinished {cart.items.length === 1 ? "item" : "items"}. Finish the sale or remove the items first.</p><Button variant="outline" onClick={() => setView("pos")}>Return to basket</Button></> : <p>Your basket is empty.</p>}
                    {branchPendingCount > 0 || branchOperationCount > 0 ? <><p>{branchPendingCount} unconfirmed {branchPendingCount === 1 ? "sale" : "sales"}{branchOperationCount > 0 ? ` and ${branchOperationCount} saved requests` : ""}. Confirm them before closing.</p><Button variant="outline" onClick={() => {setView("sync");setNavigationOpen(false);}}>Open Sync center</Button></> : <p>All saved sales and requests are confirmed.</p>}
                  </li>
                  <li><strong>Count your drawer</strong><p>Include the opening cash. Enter the money actually in the drawer; do not copy your sales total.</p></li>
                </ol>
                <form className="shift-close-form" onSubmit={(event) => {
                  event.preventDefault();
                  const counted = closingCash.trim();
                  void run(async () => {
                    if (!counted) throw new Error("Count the drawer and enter the cash amount first.");
                    if (useCart.getState().items.length) throw new Error("Finish or remove the unfinished basket before closing the shift. No sale has been saved for that basket.");
                    if (branchPendingCount) throw new Error("Synchronize every saved sale before closing the shift.");
                    if(await setting<HeldSale>(db,heldSaleKey(lease)))throw new Error("Resume or remove the held draft before closing this shift. It has not changed cash or stock.");
                    const result = await onlineOperation(db, member.userId, "close_shift", {
                      ...context(), shiftId: lease.shiftId, countedCash: cents(counted),
                    });
                    setLease(await setting<Lease>(db, "lease"));
                    setClosingDraft(undefined);
                    notify(`Shift closed. Expected cash ${money((((result.exactTotals??{}) as Row).expected_cash??result.expected_cash) as number|string)}; counted ${money((((result.exactTotals??{}) as Row).counted_cash??result.counted_cash) as number|string)}.`);
                  });
                }}>
                  <Field label="Cash counted in drawer (₱)"><input name="cash" type="number" inputMode="decimal" min="0" step="0.01" required placeholder="Enter counted cash" value={closingCash} onChange={event => setClosingDraft({shiftId: lease.shiftId, cash: event.target.value})} disabled={busy} aria-describedby="shift-close-help" /></Field>
                  {!online && <p className="shift-close-warning">Reconnect to the internet to close. Your shift and saved sales stay on this PC.</p>}
                  {practice && <p>Practice mode does not close a live cashier shift.</p>}
                  <div className="shift-close-actions">
                    <Button type="submit" disabled={!online || busy || syncing || savingSale || practice || installingUpdate || !closingCash.trim() || branchPendingCount > 0 || branchOperationCount > 0 || cart.items.length > 0 || heldDraftCount > 0}>{busy ? "Closing shift…" : "Close shift"}</Button>
                    <Button type="button" variant="outline" disabled={busy} onClick={() => setView("pos")}>Keep shift open</Button>
                  </div>
                  <p id="shift-close-help">Closing compares your count with recorded cash. If confirmation is interrupted, open Sync center and retry the original closing request. Do not close again with a different amount.</p>
                </form>
              </> : <><h2>No shift is open</h2><p>No cashier shift is open. Open one from Checkout.</p><p>Your saved sales and closing records are retained.</p><Button variant="outline" onClick={() => setView("pos")}>Return to checkout</Button></>}
            </section>
          )}

          {view === "settings" && (
            <SettingsWorkspace creditEnabled={!practice} staff={(cloud.staff_memberships??[]).map(m=>({id:str(m,"id"),name:str(m,"name"),role:str(m,"role"),active:m.active===true}))} devices={(cloud.devices??[]).map(d=>({id:str(d,"id"),name:str(d,"name"),active:d.active===true}))} branchName={selectedBranch?.name??"Selected branch"} branchCode={selectedBranch?.code??""} cashierName={lease?.name} shiftOpen={!!lease} cacheReady={!!registration?.active} onClose={()=>setView("close-shift")}><>
              <div className="two-column">
                <section className="panel">
                  <h2>Cashier shift</h2>
                  {lease ? (
                    <>
                      <dl className="detail-list">
                        <div>
                          <dt>Cashier</dt>
                          <dd>{lease.name}</dd>
                        </div>
                        <div>
                          <dt>Branch</dt>
                          <dd>{selectedBranch?.name}</dd>
                        </div>
                        <div>
                          <dt>{onlineCashOnly?"Shift authorization until":"Offline authorization until"}</dt>
                          <dd>
                            {when(new Date(lease.expiresAt).toISOString())}
                          </dd>
                        </div>
                        <div>
                          <dt>Unconfirmed local sales</dt>
                          <dd>{branchPendingCount}</dd>
                        </div>
                      </dl>
                      <Button
                        variant="outline"
                        disabled={!online || busy || practice}
                        onClick={() =>
                          void run(async () => {
                            await requireNoPendingClosure(db, member.organizationId, branchId);
                            const next = await command<Lease>("renew_shift", {
                              ...context(),
                              deviceId: lease.deviceId,
                            });
                            await setSetting(db, "lease", next);
                            setLease(next);
                            notify(onlineCashOnly?"Shift authorization renewed. Checkout still requires internet.":"Shift authorization renewed for 12 hours.");
                          })
                        }
                      >
                        {onlineCashOnly?"Renew shift authorization":"Renew offline authorization"}
                      </Button>
                      <Button variant="outline" disabled={busy || savingSale || installingUpdate} onClick={() => setView("close-shift")}>Count cash & close shift</Button>
                      <p>Use Close shift at the top of any screen to finish your day.</p>
                    </>
                  ) : (
                    <p className="muted">
                      No cashier shift is open. Open one from Checkout.
                    </p>
                  )}
                </section>
                <section className="panel">
                  <h2>Application & recovery</h2>
                  <StorageHealth appInstall={appInstall} appName="Better Yield" />
                  <dl className="detail-list">
                    <div>
                      <dt>Database</dt>
                      <dd>
                        {practice ? "Practice · local only" : "Live business"}
                      </dd>
                    </div>
                    <div>
                      <dt>Catalog saved</dt>
                      <dd>{when(snapshotAt)}</dd>
                    </div>
                    <div>
                      <dt>Application cache</dt>
                      <dd>
                        {registration?.active
                          ? "Offline files ready"
                          : registration
                            ? "Preparing offline files…"
                            : "Available in production build"}
                      </dd>
                    </div>
                  </dl>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => void run(exportLocalRecovery, false)}
                  >
                    {currentRecoveryArchive ? `Export recovery part ${currentRecoveryArchive.next} of ${currentRecoveryArchive.parts}` : "Export local recovery file"}
                  </Button>
                  {recoveryDownloadNotice()}
                  <Button
                    variant="outline"
                    disabled={
                      !registration ||
                      !online ||
                      busy ||
                      installingUpdate ||
                      !!cart.items.length ||
                      allPendingCount > 0 ||
                      allOperationCount > 0
                    }
                    onClick={() =>
                      void run(async () => {
                        setUpdateFeedback(
                          "Checking and downloading any available update…",
                        );
                        let waiting: ServiceWorker | null;
                        try {
                          waiting = await findReadyUpdate(registration!);
                        } catch (error) {
                          setUpdateFeedback(
                            error instanceof Error
                              ? error.message
                              : "Could not check for an update. Try again online.",
                          );
                          throw error;
                        }
                        if (!waiting) {
                          setUpdateFeedback(
                            "No new download is available. If an earlier update is not visible, close and reopen Better Yield. Keep this browser's site data.",
                          );
                          notify("No new app download is available.");
                          return;
                        }
                        const canRestart = async () => {
                          const [sales, operations] = await Promise.all([
                            db.sales.where("status").anyOf(unresolvedStates).count(),
                            pendingOperations(db),
                          ]);
                          return (
                            !useCart.getState().items.length &&
                            !committing.current &&
                            !sales &&
                            !operations.length
                          );
                        };
                        updateLock.current = true;
                        setInstallingUpdate(true);
                        let restarting = false;
                        try {
                          setUpdateFeedback(
                            "Update downloaded. Installing it before reopening Better Yield…",
                          );
                          const result = await activateReadyUpdate(
                            waiting,
                            canRestart,
                            () => {
                              setUpdateFeedback(
                                "Update installed. Reopening Better Yield… If this window stays open, close it and reopen Better Yield. Keep this browser's site data.",
                              );
                              const destination = new URL(window.location.href);
                              destination.searchParams.set(
                                "app-update",
                                String(Date.now()),
                              );
                              destination.hash = "";
                              window.location.replace(destination.href);
                            },
                          );
                          restarting = result === "restarting";
                          if (!restarting)
                            setUpdateFeedback(
                              "Update ready. Finish checkout and confirm every pending record before reopening Better Yield.",
                            );
                        } catch (error) {
                          setUpdateFeedback(
                            error instanceof Error
                              ? error.message
                              : "Could not install the update. Check again online.",
                          );
                          throw error;
                        } finally {
                          if (!restarting) {
                            updateLock.current = false;
                            setInstallingUpdate(false);
                          }
                        }
                      }, false)
                    }
                  >
                    Check for app update
                  </Button>
                  <small className="muted block">
                    Updates wait until the cart and upload queue are clear.
                  </small>
                  {updateFeedback && (
                    <p role="status" className="muted">
                      {updateFeedback}
                    </p>
                  )}
                </section>
              </div>
              <OperatingGuide key={`operating:${member.organizationId}:${branchId}:${member.userId}`} db={db} scope={{organizationId:member.organizationId,branchId,actorId:member.userId,role:member.role}} branchName={selectedBranch?.name??"Selected branch"} online={online} cached={!!registration?.active} practice={practice} disabled={busy||installingUpdate} onRefreshCatalog={()=>run(()=>refreshCloud(true),false)} onSync={()=>setView("sync")}/>
              {isOwner && (
                <>
                  <section className="panel">
                    <h2>Staff access</h2>
                    <p className="muted">
                      Employees create and confirm their own account first. Add
                      their registered email below.
                    </p>
                    {(cloud.staff_memberships ?? []).length > 0 &&
                      table(
                        ["Name", "Role", "Branch", "Access", "Action"],
                        (cloud.staff_memberships ?? []).map((m) => (
                          <tr key={str(m, "id")}>
                            <td>{str(m, "name")}</td>
                            <td>{str(m, "role").replace("_", " ")}</td>
                            <td>
                              {m.branch_id
                                ? branchName(m.branch_id)
                                : "All branches"}
                            </td>
                            <td>{m.active ? "Active" : "Revoked"}</td>
                            <td>
                              {m.role !== "owner" && m.active === true && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={!online || busy || practice}
                                  onClick={() =>
                                    void run(async () => {
                                      await command("revoke_staff", {
                                        ...context(),
                                        membershipId: m.id,
                                      });
                                      notify(
                                        "Employee access revoked. Offline devices apply this when they reconnect.",
                                      );
                                    })
                                  }
                                >
                                  Revoke access
                                </Button>
                              )}
                            </td>
                          </tr>
                        )),
                      )}
                    <form
                      className="form-grid spaced-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        void run(async () => {
                          await command("staff_access", {
                            organizationId: member.organizationId,
                            branchId: inputValue(f, "branch"),
                            email: inputValue(f, "email"),
                            name: inputValue(f, "name"),
                            role: inputValue(f, "role"),
                          });
                          notify("Employee access saved.");
                        });
                      }}
                    >
                      <Field label="Employee name">
                        <input name="name" required />
                      </Field>
                      <Field label="Registered email">
                        <input name="email" type="email" required />
                      </Field>
                      <Field label="Branch">
                        <select name="branch">
                          {branchList.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Role">
                        <select name="role">
                          <option value="cashier">Cashier</option>
                          <option value="manager">Branch manager</option>
                          <option value="stock_staff">Stock staff</option>
                        </select>
                      </Field>
                      <Button disabled={!online || busy || practice}>
                        Save employee access
                      </Button>
                    </form>
                  </section>
                  <section className="panel">
                    <h2>Registered cashier PCs</h2>
                    {isOwner&&<CashierPcMode enabled={selectedBranch?.multiPc===true} disabled={!online||busy||practice||!!lease||branchPendingCount>0||branchOperationCount>0||cart.items.length>0} onEnable={reason=>run(async()=>{await onlineOperation(db,member.userId,'configure_cashier_pcs',{...context(),enabled:true,reason});notify('Multiple cashier PCs enabled. Each sale now needs online confirmation.');},true,true)}/>}
                    {table(
                      ["PC", "Branch", "Status", "Last sync", "Action"],
                      (cloud.devices ?? []).map((d) => (
                        <tr key={str(d, "id")} data-device-id={str(d, "id")}>
                          <td>{str(d, "name")}</td>
                          <td>{branchName(d.branch_id)}</td>
                          <td>{d.active ? "Active" : "Retired"}</td>
                          <td>{when(d.last_sync)}</td>
                          <td>
                            {d.active === false && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={
                                  !online ||
                                  busy ||
                                  practice ||
                                  allPendingCount > 0 ||
                                  allOperationCount > 0 ||
                                  cart.items.length > 0
                                }
                                onClick={() =>
                                  void run(async () => {
                                    if (
                                      (await setting<string>(
                                        db,
                                        "deviceId",
                                      )) !== d.id
                                    )
                                      throw new Error(
                                        "This retired registration belongs to a different browser. Use the browser registered to it.",
                                      );
                                    if (
                                      useCart.getState().items.length ||
                                      (await db.sales
                                        .where("status")
                                        .anyOf(unresolvedStates)
                                        .count()) ||
                                      (await pendingOperations(db)).length
                                    )
                                      throw new Error(
                                        "Finish the basket and resolve pending records before releasing this PC setup. Saved records are retained.",
                                      );
                                    const retired = await supabase
                                      .from("devices")
                                      .select("active")
                                      .eq("id", str(d, "id"))
                                      .eq(
                                        "organization_id",
                                        member.organizationId,
                                      )
                                      .eq("branch_id", str(d, "branch_id"))
                                      .single();
                                    if (retired.error)
                                      throw new Error(retired.error.message);
                                    if (retired.data.active !== false)
                                      throw new Error(
                                        "This PC is still active. Refresh the registered PC list first.",
                                      );
                                    await forgetRetiredDevice(db, str(d, "id"));
                                    setLease(undefined);
                                    notify(
                                      "Retired setup released on this browser. Saved sales are retained. Open a shift to register its replacement.",
                                    );
                                  })
                                }
                              >
                                Release retired setup
                              </Button>
                            )}
                            {d.active === true && (
                              <ApprovalForm
                                action="Retire PC"
                                label="PC retirement reason"
                                description="Retire this PC and close its open shift. Its saved records remain recoverable; counted cash will need owner review."
                                confirmLabel="Confirm PC retirement"
                                disabled={
                                  !online ||
                                  busy ||
                                  practice ||
                                  (d.id === lease?.deviceId &&
                                    pending.length > 0)
                                }
                                onConfirm={(reason) =>
                                  run(async () => {
                                    await command("retire_device", {
                                      organizationId: member.organizationId,
                                      branchId: d.branch_id,
                                      deviceId: d.id,
                                      reason,
                                      countedCash: null,
                                    });
                                    await forgetRetiredDevice(db, str(d, "id"));
                                    if (d.id === lease?.deviceId) {
                                      setLease(undefined);
                                    }
                                    notify(
                                      "PC retired. Its records remain available; recover original pending sales through the Sync center.",
                                    );
                                  })
                                }
                              />
                            )}
                          </td>
                        </tr>
                      )),
                    )}
                  </section>
                  <section className="panel">
                    {branchLocked ? <><h2>Branch</h2><p><strong>{selectedBranch?.name}</strong></p><p className="muted">This store is configured for one branch. Contact your service provider for changes to the branch setup.</p></> : <><h2>Branches</h2>
                    <p className="muted">
                      Rename your stores or add another branch as your business
                      grows.
                    </p>
                    <div className="branch-forms">
                      {branchList.map((b) => (
                        <form
                          key={b.id}
                          onSubmit={(e) => {
                            e.preventDefault();
                            const f = new FormData(e.currentTarget);
                            void run(async () => {
                              await command("rename_branch", {
                                organizationId: member.organizationId,
                                branchId: b.id,
                                name: inputValue(f, "name"),
                              });
                              const next = await fetchBranches(
                                member.organizationId,
                              );
                              setBranchList(next);
                              await setSetting(db, "branches", next);
                              notify("Branch renamed.");
                            });
                          }}
                        >
                          <Field label={b.code}>
                            <input
                              name="name"
                              defaultValue={b.name}
                              required
                              maxLength={120}
                            />
                          </Field>
                          <Button
                            variant="outline"
                            disabled={!online || busy || practice}
                          >
                            <span className="sr-only">
                              Save {b.code} branch name
                            </span>
                            <span aria-hidden="true">Save</span>
                          </Button>
                        </form>
                      ))}
                    </div>
                    <form
                      className="form-grid"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const form = e.currentTarget;
                        const f = new FormData(form);
                        void run(async () => {
                          setBranchFeedback({
                            kind: "pending",
                            text: "Adding branch…",
                          });
                          try {
                            await onlineOperation(
                              db,
                              member.userId,
                              "create_branch",
                              {
                                organizationId: member.organizationId,
                                name: inputValue(f, "name"),
                              },
                              "newBranchId",
                            );
                          } catch (error) {
                            setBranchFeedback({
                              kind: "error",
                              text: `${error instanceof Error ? error.message : "Could not confirm the branch."} Check Sync center for any request awaiting confirmation.`,
                            });
                            throw error;
                          }
                          // A confirmed write stays a success even if refreshing
                          // the list fails. Never invite another creation attempt.
                          form.reset();
                          setBranchFeedback({
                            kind: "success",
                            text: "Branch added. Choose it from the branch menu to prepare its stock and cashier PC.",
                          });
                          try {
                            const next = await fetchBranches(
                              member.organizationId,
                            );
                            setBranchList(next);
                            await setSetting(db, "branches", next);
                          } catch (error) {
                            setBranchFeedback({
                              kind: "success",
                              text: "Branch added. Select Refresh to load it in the branch menu.",
                            });
                            throw error;
                          }
                        });
                      }}
                    >
                      <Field label="New branch name">
                        <input
                          name="name"
                          required
                          maxLength={120}
                          placeholder="Store name or location"
                        />
                      </Field>
                      <Button disabled={!online || busy || practice}>
                        {branchFeedback?.kind === "pending"
                          ? "Adding branch…"
                          : "Add branch"}
                      </Button>
                    </form>
                    {branchFeedback && (
                      <p
                        role={
                          branchFeedback.kind === "error" ? "alert" : "status"
                        }
                        className={
                          branchFeedback.kind === "error"
                            ? "notice error"
                            : "muted"
                        }
                      >
                        {branchFeedback.text}
                      </p>
                    )}
                    <p className="muted">
                      Branch codes are assigned automatically. Adding a branch
                      requires an internet connection.
                    </p>
                    </>}
                  </section>
                </>
              )}
            </></SettingsWorkspace>
          )}
        </main>
        <footer className="workspace-footer">
          <span>
            <Sprout size={14} />
            Better Yield POS
          </span>
          <span>
            {practice
              ? "Sample data · local practice"
              : `${selectedBranch?.name ?? "Select a branch"} · Cash and credit sales`}
            <span className="footer-dot">·</span>Not a tax invoice system
          </span>
        </footer>
      </div>
    </div>
  );
}

function StockSelect({ products,onChange,value }: { products: Product[];onChange?:(value:string)=>void;value?:string }) {
  return (
    <Field label="Product / batch">
      <SearchableSelect name="stock" aria-label="Product / batch" required value={value} onValueChange={value =>onChange?.(value)}>
        {products.flatMap((p) =>
          p.batches.length
            ? p.batches.map((b) => (
                <option key={b.id} value={`${p.id}:${b.id}`} data-search={`${p.sku} ${("originalCode" in p ? String(p.originalCode??"") : "")}`}>
                  {p.name} · {b.lot} ({p.baseUnit})
                </option>
              ))
            : [
                <option key={p.id} value={`${p.id}:none`} data-search={`${p.sku} ${("originalCode" in p ? String(p.originalCode??"") : "")}`}>
                  {p.name} ({p.baseUnit})
                </option>,
              ],
        )}
      </SearchableSelect>
    </Field>
  );
}
