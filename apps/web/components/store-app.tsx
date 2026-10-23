"use client";

/* WORLD: A cooperative store's orderly stock book: forest ink, warm paper, ruled tables, precise figures.
   STORY: Cashiers complete a cash sale; owners follow each stock change back to its source.
   FIRST VIEWPORT: A fixed narrow navigation rail, branch and connection bar, searchable product grid,
   and a persistent receipt at the right. The checkout action stays next to the amount due.
   FORM: Cooperative stock book, candidate 4; seed ee1989fc. Product clarity outranks decorative motion.
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
  ArrowLeftRight,
  ArrowRight,
  BarChart3,
  Check,
  CheckCheck,
  ChevronDown,
  ClipboardCheck,
  CloudOff,
  FileText,
  FlaskConical,
  HeartPulse,
  Leaf,
  LogOut,
  Package,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBasket,
  ShoppingCart,
  Sprout,
  Truck,
  Wifi,
  WifiOff,
  Wheat,
  Wrench,
  X,
} from "lucide-react";
import Decimal from "decimal.js";
import { SaleLineEditor } from "./sale-line-editor";
import {
  makeItem,
  money,
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
  forgetRetiredDevice,
  importRecovery,
  localStock,
  retrySale,
  saveCheckout,
  setSetting,
  setting,
  syncOnce,
  type LocalSale,
} from "@agristore/offline";
import {
  branches as fetchBranches,
  cloudTransport,
  command,
  memberships,
  rows,
  salesPage,
  type SalesCursor,
  supabase,
} from "../lib/api";
import { practiceBranch, startPractice } from "../lib/practice";
import { useCart } from "../lib/cart";
import {
  onlineOperation,
  pendingOperations,
  retryOperation,
  type PendingOperation,
} from "../lib/operations";
import { Button } from "./ui/button";
import { activateReadyUpdate, findReadyUpdate } from "../lib/pwa-update";
import { ApprovalForm } from "./approval-form";
import { HistoryRegister } from "./history-register";
import type { HistoryKind } from "../lib/history";

type View =
  | "pos"
  | "overview"
  | "inventory"
  | "receiving"
  | "transfers"
  | "counts"
  | "sales"
  | "sync"
  | "settings";
type Row = Record<string, unknown>;
const navigation = [
  { id: "pos", label: "Checkout", icon: ShoppingBasket },
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "receiving", label: "Purchasing", icon: Truck },
  { id: "transfers", label: "Transfers", icon: ArrowLeftRight },
  { id: "counts", label: "Stock counts", icon: ClipboardCheck },
  { id: "sales", label: "Sales & receipts", icon: FileText },
] as const;
const viewTables: Record<View, string[]> = {
  pos: [],
  overview: ["audit_events", "cashier_shifts", "inventory_movements"],
  inventory: [],
  receiving: ["suppliers"],
  transfers: [],
  counts: [],
  sales: [],
  sync: [],
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
const batchKey = (p: string, b: string | null) => `${p}:${b ?? "none"}`;

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
  const [allPendingCount, setAllPendingCount] = useState(0);
  const [allOperationCount, setAllOperationCount] = useState(0);
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
  const [cloud, setCloud] = useState<Record<string, Row[]>>({}),
    [lastSync, setLastSync] = useState<string>(),
    [snapshotAt, setSnapshotAt] = useState<string>();
  const [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [syncing, setSyncing] = useState(false),
    [registration, setRegistration] = useState<ServiceWorkerRegistration>();
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("All products"),
    [cash, setCash] = useState(""),
    [checkoutDone, setCheckoutDone] = useState<LocalSale>();
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [salesCursor, setSalesCursor] = useState<SalesCursor>();
  const [savingSale, setSavingSale] = useState(false);
  const [historyRevision, setHistoryRevision] = useState(0);
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
  const cart = useCart();
  const committing = useRef(false);
  const operationBusy = useRef(false);
  const syncingRef = useRef(false);
  const contextGeneration = useRef(0);
  const cloudRequest = useRef(0);
  const notify = useCallback((text: string) => {
    setMessage(text);
    setError("");
  }, []);
  const fail = useCallback((e: unknown) => {
    setError(
      e instanceof Error && "issues" in e
        ? (e as Error & { issues: { message: string }[] }).issues
            .map((i) => i.message)
            .join(". ")
        : e instanceof Error
          ? e.message
          : "Something went wrong. Your completed sales are still saved.",
    );
    setMessage("");
  }, []);
  const selectedBranch = branchList.find((b) => b.id === branchId);
  const isOwner = member?.role === "owner";
  const isStock = member?.role === "stock_staff";
  const pending = sales.filter((s) => s.status !== "synced");
  const context = useCallback(() => {
    if (!member || !branchId)
      throw new Error("Choose your business and branch first");
    return { organizationId: member.organizationId, branchId };
  }, [member, branchId]);
  const refreshLocal = useCallback(async () => {
    setProducts(await db.products.toArray());
    setStock(await localStock(db));
    const all = await db.sales.toArray();
    setAllPendingCount(all.filter((s) => s.status !== "synced").length);
    const org = lease?.organizationId ?? member?.organizationId,
      b = lease?.branchId ?? branchId,
      user = lease?.cashierId ?? member?.userId,
      role = lease?.role ?? member?.role;
    setSales(
      all
        .filter(
          (s) =>
            s.payload.organizationId === org &&
            s.payload.branchId === b &&
            (role === "owner" || s.payload.cashierId === user),
        )
        .sort((a, b) =>
          b.payload.occurredAt.localeCompare(a.payload.occurredAt),
        ),
    );
    const allOperations = await pendingOperations(db);
    setAllOperationCount(allOperations.length);
    setOperations(
      allOperations.filter(
        (op) =>
          op.data.organizationId === org &&
          (!op.data.branchId || op.data.branchId === b) &&
          (role === "owner" || op.actorId === user),
      ),
    );
    setLastSync(await setting<string>(db, "lastSync"));
    setSnapshotAt(await setting<string>(db, "snapshotAsOf"));
  }, [db, lease, member, branchId]);
  const refreshCloud = useCallback(async () => {
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
      !lease
        ? command<Snapshot>("snapshot", {
            organizationId: member.organizationId,
            branchId,
            transactionIds: (
              await db.sales.where("status").notEqual("synced").toArray()
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
      setProducts(snapshot.products);
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
    setSalesCursor(page?.next);
  }, [practice, member, branchId, db, view, lease]);
  const sync = useCallback(async () => {
    if (practice || !lease || !navigator.onLine || syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      await syncOnce(db, cloudTransport(lease));
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
    contextGeneration.current++;
    let alive = true;
    (async () => {
      setReady(false);
      if (!practice && localStorage.getItem("agristore-mode") === "practice") {
        setPractice(true);
        return;
      }
      await db.open();
      const saved = practice
        ? await startPractice(db)
        : await setting<Lease>(db, "lease");
      if (!alive) return;
      setLease(saved);
      setBranchId(saved?.branchId ?? "");
      if (practice) {
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
        setMember(await setting<Membership>(db, "membership"));
        setBranchList((await setting<Branch[]>(db, "branches")) ?? []);
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!alive) return;
        setSignedIn(!!session || !!saved);
        if (navigator.onLine && session) {
          const found = await memberships();
          if (!alive) return;
          const m =
            found.find((m) => m.organizationId === saved?.organizationId) ??
            found[0];
          setMember(m);
          if (m) {
            const b = await fetchBranches(m.organizationId);
            setBranchList(b);
            setBranchId(saved?.branchId ?? m.branchId ?? b[0]?.id ?? "");
            await setSetting(db, "membership", m);
            await setSetting(db, "branches", b);
            const target = saved?.branchId ?? m.branchId ?? b[0]?.id;
            if (target)
              await applySnapshot(
                db,
                await command<Snapshot>("snapshot", {
                  organizationId: m.organizationId,
                  branchId: target,
                  deviceId: saved?.deviceId,
                  transactionIds: (
                    await db.sales.where("status").notEqual("synced").toArray()
                  ).map((s) => s.id),
                }),
              );
            if (m.role === "stock_staff") setView("inventory");
          }
        }
      }
      if (navigator.storage?.persist && !practice)
        await navigator.storage.persist();
      if (alive) setReady(true);
    })().catch((e) => {
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
    if (!ready || !online) return;
    if (!operationBusy.current) void sync();
    const timer = setInterval(() => {
      if (!operationBusy.current) void sync();
    }, 15_000);
    return () => clearInterval(timer);
  }, [ready, online, sync]);
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
  }, [fail]);
  const run = async (fn: () => Promise<void>, refresh = true) => {
    if (operationBusy.current)
      return new Error(
        "Wait for the current operation to finish, then try again.",
      );
    operationBusy.current = true;
    setBusy(true);
    setError("");
    const generation = contextGeneration.current;
    try {
      await fn();
      if (generation === contextGeneration.current && refresh) {
        await refreshCloud();
      }
    } catch (e) {
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
      setCloud({});
      setProducts([]);
      setStock(new Map());
      await clearAccountCache(db);
      const email = inputValue(form, "email"),
        password = String(form.get("password") ?? "");
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
      if (found[0]) {
        const b = await fetchBranches(found[0].organizationId);
        const target = found[0].branchId ?? b[0]?.id;
        if (!target) throw new Error("Ask your owner to assign your branch.");
        const snapshot = await command<Snapshot>("snapshot", {
          organizationId: found[0].organizationId,
          branchId: target,
          transactionIds: (
            await db.sales.where("status").notEqual("synced").toArray()
          ).map((s) => s.id),
        });
        await applySnapshot(db, snapshot);
        const nextStock = await localStock(db);
        setProducts(snapshot.products);
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
  async function bootstrap(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    await run(async () => {
      await command("bootstrap", {
        name: inputValue(f, "business"),
        ownerName: inputValue(f, "name"),
      });
      const m = (await memberships())[0];
      contextGeneration.current++;
      setMember(m);
      const b = await fetchBranches(m.organizationId);
      setBranchList(b);
      setBranchId(b[0].id);
      await setSetting(db, "membership", m);
      await setSetting(db, "branches", b);
      notify(
        "Your business is ready with three starter branches. Add more under Settings, then prepare products and opening stock.",
      );
    });
  }
  async function openShift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    await run(async () => {
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
      const transport = cloudTransport(next);
      await applySnapshot(
        db,
        await transport.snapshot((await db.sales.toArray()).map((s) => s.id)),
      );
      notify("Shift open. Your product catalog is saved on this PC.");
    });
  }
  async function finishSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (committing.current || updateLock.current) return;
    committing.current = true;
    setBusy(true);
    setSavingSale(true);
    try {
      requireLease(lease);
      if (!cart.items.length)
        throw new Error("Add a product to the receipt first");
      if (Object.keys(useCart.getState().quantityErrors).length)
        throw new Error(
          "Check quantities and confirm weighed amounts before checkout.",
        );
      const payload: Sale = {
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
      const saved = await saveCheckout(db, payload);
      setCheckoutDone(saved);
      cart.clear();
      setCash("");
      await refreshLocal();
      notify(
        practice
          ? "Practice sale saved on this PC."
          : "Cash sale saved on this PC.",
      );
      void sync();
    } catch (e) {
      fail(e);
    } finally {
      committing.current = false;
      setBusy(false);
      setSavingSale(false);
    }
  }
  function addProduct(p: Product, unitId?: string, batchId?: string | null) {
    if (updateLock.current) return;
    try {
      const batch = p.batches.find(
        (b) =>
          !b.expiresOn ||
          b.expiresOn >=
            new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }),
      );
      cart.add(
        makeItem(
          p,
          unitId ?? p.units[0].id,
          "1",
          batchId === undefined ? (batch?.id ?? null) : batchId,
        ),
      );
      setCheckoutDone(undefined);
    } catch (e) {
      fail(e);
    }
  }
  async function logout() {
    await run(async () => {
      if (practice) {
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
          "Reconnect before signing out. Your current shift can continue offline.",
        );
      if (syncingRef.current)
        throw new Error(
          "Wait for the current synchronization to finish before signing out.",
        );
      contextGeneration.current++;
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
      setCheckoutDone(undefined);
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
  const branchName = (id: unknown) =>
    branchList.find((b) => b.id === id)?.name ?? "Branch";
  const table = (
    headers: string[],
    body: React.ReactNode,
    kind?: HistoryKind,
  ) => (
    <div
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
      <table>
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
      </table>
    </div>
  );
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
        <p>Opening AgriStore…</p>
      </div>
    );
  if (!signedIn)
    return (
      <main className="auth-page">
        <section className="auth-story">
          <div className="wordmark">
            <Sprout size={30} /> AgriStore<span>POS</span>
          </div>
          <div>
            <h1>
              A clear record.
              <br />A better day
              <br />
              at the store.
            </h1>
            <p>
              Every sale, every sack, every branch.
              <br />
              Keep your store moving, even when the internet doesn’t.
            </p>
            <div className="auth-proof">
              <ShieldCheck size={21} />
              <span>
                Cash checkout · Growing with your stores · Offline ready
              </span>
            </div>
          </div>
          <span className="auth-foot">
            Built for the everyday work of an agri store.
          </span>
        </section>
        <section className="auth-form">
          <div className="auth-form-inner">
            <span className="small-brand">
              <Sprout size={22} /> AgriStore POS
            </span>
            <h2>
              {authMode === "login"
                ? "Welcome to your store."
                : "Create your account."}
            </h2>
            <p>
              {authMode === "login"
                ? "Sign in to open your shift and get started."
                : "Owners and employees use their own accounts."}
            </p>
            {Notice}
            <form onSubmit={auth}>
              <Field label="Email address">
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                />
              </Field>
              <Field label="Password">
                <input
                  name="password"
                  type="password"
                  autoComplete={
                    authMode === "login" ? "current-password" : "new-password"
                  }
                  minLength={8}
                  required
                  placeholder="At least 8 characters"
                />
              </Field>
              <Button disabled={busy || !online} type="submit">
                {busy
                  ? "Please wait…"
                  : authMode === "login"
                    ? "Sign in"
                    : "Create account"}
                <ArrowRight size={17} />
              </Button>
            </form>
            <button
              className="text-button auth-switch"
              onClick={() =>
                setAuthMode(authMode === "login" ? "signup" : "login")
              }
            >
              {authMode === "login"
                ? "First time here? Create an account"
                : "Already registered? Sign in"}
            </button>
            <div className="practice-entry">
              <span>Take a look around first</span>
              <Button
                variant="outline"
                onClick={() => {
                  localStorage.setItem("agristore-mode", "practice");
                  cart.clear();
                  setPractice(true);
                }}
              >
                Try practice checkout
                <ArrowRight size={16} />
              </Button>
              <small>
                Sample products. Separate local data. No real transactions.
              </small>
            </div>
          </div>
        </section>
      </main>
    );
  if (!member)
    return (
      <main className="setup-page">
        <div className="setup-panel">
          <Sprout size={34} />
          <h1>Let’s set up your stores.</h1>
          <p>
            If you’re an employee, ask your owner to add your account under
            Staff access, then sign in again. Business owners can create their
            business below. Start with three branches and add more in Settings.
          </p>
          {Notice}
          <form onSubmit={bootstrap}>
            <Field label="Business name">
              <input
                name="business"
                required
                maxLength={120}
                placeholder="Your agricultural supply business"
              />
            </Field>
            <Field label="Your name">
              <input name="name" required placeholder="Owner name" />
            </Field>
            <Button disabled={busy || !online}>Create business</Button>
          </form>
          <Button variant="ghost" onClick={() => void logout()}>
            Sign out
          </Button>
        </div>
      </main>
    );
  const categories = [
    "All products",
    ...new Set(products.map((p) => p.category)),
  ];
  const visible = products.filter(
    (p) =>
      p.active &&
      (category === "All products" || p.category === category) &&
      `${p.name} ${p.sku}`.toLowerCase().includes(query.toLowerCase()),
  );
  const grandTotal = total(cart.items);
  let change = 0;
  try {
    change = Math.max(0, cents(cash) - grandTotal);
  } catch {}
  const branchSales = (cloud.sales ?? []).filter(
    (s) => s.branch_id === branchId,
  );
  const summary = cloud.summary?.[0] ?? {};
  const branchTotals = (summary.branchTotals ?? []) as Row[];
  const titles: Record<View, string> = {
    pos: "Checkout",
    overview: "Your stores, at a glance.",
    inventory: "Inventory",
    receiving: "Purchasing & receiving",
    transfers: "Branch transfers",
    counts: "Physical stock counts",
    sales: "Sales & receipts",
    sync: "Synchronization",
    settings: "Store settings",
  };
  const descriptions: Record<View, string> = {
    pos: "A good day starts with a clear record.",
    overview: "Follow sales, stock, and the things that need your attention.",
    inventory: "Know what’s on hand, down to the last kilo.",
    receiving: "Record the goods that arrive at your branch.",
    transfers: "Follow stock from dispatch to arrival.",
    counts: "Compare what’s on the shelf with what’s in the book.",
    sales: "Every completed checkout, with its original record.",
    sync: "Every saved sale has a place. Nothing disappears from the queue.",
    settings: "Your people, your branches, and your cashier shift.",
  };
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <aside className="sidebar">
        <a
          href="#main"
          className="wordmark"
          aria-label="AgriStore Point of Sale home"
        >
          <Sprout size={28} />
          <span>
            AgriStore <small>POINT OF SALE</small>
          </span>
        </a>
        <nav aria-label="Main navigation">
          {navigation
            .filter(
              (n) => !isStock || !["pos", "overview", "sales"].includes(n.id),
            )
            .map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                title={label}
                aria-label={id === "pos" ? `${label} POS` : label}
                className={view === id ? "nav-item active" : "nav-item"}
                aria-current={view === id ? "page" : undefined}
                onClick={() => setView(id)}
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
            onClick={() => setView("sync")}
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
            onClick={() => setView("settings")}
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
              <Sprout size={18} />
            </span>
            <select
              aria-label="Current branch"
              value={branchId}
              disabled={!!lease || busy || (!online && !practice)}
              onChange={(e) => {
                const nextBranchId = e.target.value;
                void run(async () => {
                  contextGeneration.current++;
                  const snapshot = await command<Snapshot>("snapshot", {
                    organizationId: member.organizationId,
                    branchId: nextBranchId,
                    transactionIds: (
                      await db.sales
                        .where("status")
                        .notEqual("synced")
                        .toArray()
                    ).map((sale) => sale.id),
                  });
                  await applySnapshot(db, snapshot);
                  const nextStock = await localStock(db);
                  // Change the displayed branch and its stock together. Failed
                  // downloads leave the previously loaded branch selected.
                  setBranchId(nextBranchId);
                  setOpeningImport(undefined);
                  setCloud({});
                  setSalesCursor(undefined);
                  setProducts(snapshot.products);
                  setStock(nextStock);
                  setSnapshotAt(snapshot.asOf);
                  notify("Branch stock loaded.");
                });
              }}
            >
              {branchList
                .filter((b) => isOwner || b.id === member.branchId)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
            </select>
            <ChevronDown size={14} />
          </div>
          <div className="topbar-right">
            <span className={`connection ${online ? "" : "offline"}`}>
              {online ? <Wifi size={15} /> : <WifiOff size={15} />}
              <span>
                {practice
                  ? "Practice data"
                  : online
                    ? "Connected"
                    : "Offline · sales saved here"}
              </span>
            </span>
            <span className="today">
              {new Intl.DateTimeFormat("en-PH", {
                month: "short",
                day: "numeric",
                year: "numeric",
                timeZone: "Asia/Manila",
              }).format(new Date())}
            </span>
          </div>
        </header>
        {practice && (
          <div className="practice-banner">
            <span>
              <strong>Practice mode</strong> — sample products and local-only
              sales. Your live stores are separate.
            </span>
            <button onClick={() => void logout()}>
              Return to sign in
              <ArrowRight size={14} />
            </button>
          </div>
        )}
        <main id="main" className="main-content" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <h1 ref={contentHeading} tabIndex={-1}>
                {titles[view]}
              </h1>
              <p>{descriptions[view]}</p>
            </div>
            <div className="heading-actions">
              {lease && (
                <span className="shift-badge">
                  <span />
                  Shift open
                </span>
              )}
              {view !== "pos" && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!online || busy || practice}
                  onClick={() =>
                    void run(async () => {
                      await refreshCloud();
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
          </div>
          {Notice}
          {!practice && view === "overview" && (
            <p className="muted">
              Sales totals include all confirmed records. Flag, reconciliation
              and movement previews show up to the most recent 1,000 entries.
              The audit register below has its own branch and date filters.
            </p>
          )}
          {!practice &&
            view !== "sales" &&
            Object.values(cloud).some((list) => list.length >= 1000) && (
              <p role="status" className="notice error">
                Showing the most recent 1,000 entries in this view. Older
                records remain stored.
              </p>
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
              <section className="catalog">
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
                <div className="catalog-meta">
                  <span>{visible.length} products</span>
                  <span>Prices in Philippine pesos</span>
                </div>
                {visible.length ? (
                  <div className="product-grid">
                    {visible.map((p) => {
                      const available = p.units[0]
                        ? new Decimal(
                            stock.get(batchKey(p.id, null)) ??
                              [...stock.entries()]
                                .filter(([k]) => k.startsWith(p.id + ":"))
                                .reduce((s, [, v]) => s + Number(v), 0),
                          )
                            .div(p.units[0].factor)
                            .toDecimalPlaces(2)
                            .toString()
                        : "0";
                      return (
                        <article
                          className={
                            !lease || isStock || installingUpdate
                              ? "product product-unavailable"
                              : "product"
                          }
                          key={p.id}
                        >
                          <div
                            className={`product-art art-${p.category.toLowerCase().replace(/\W/g, "")}`}
                          >
                            {p.category === "Feeds" ? (
                              <Wheat size={23} />
                            ) : p.category === "Fertilizers" ? (
                              <FlaskConical size={23} />
                            ) : p.category === "Tools" ? (
                              <Wrench size={23} />
                            ) : p.category === "Animal care" ? (
                              <HeartPulse size={23} />
                            ) : p.category === "Seeds" ? (
                              <Sprout size={23} />
                            ) : (
                              <Leaf size={23} />
                            )}
                            <span className="product-category">
                              {p.category}
                            </span>
                          </div>
                          <div className="product-details">
                            <span className="product-sku">{p.sku}</span>
                            <h3>{p.name}</h3>
                            <span className="unit-label">
                              {p.units[0]?.name}
                            </span>
                            <div className="product-footer">
                              <strong>{money(p.units[0]?.price ?? 0)}</strong>
                              <button
                                className="add-product"
                                onClick={() => addProduct(p)}
                                disabled={!lease || isStock || installingUpdate}
                                aria-label={`Add ${p.name}`}
                              >
                                <Plus size={17} />
                              </button>
                            </div>
                            <span
                              className={
                                Number(available) <= 0
                                  ? "stock-label low"
                                  : "stock-label"
                              }
                            >
                              {available} {p.units[0]?.name.toLowerCase()} on
                              hand
                            </span>
                          </div>
                        </article>
                      );
                    })}
                  </div>
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
                      {cart.items.length === 1 ? "item" : "items"} · Cash
                      payment
                    </span>
                  </div>
                  <ShoppingCart size={21} />
                </div>
                {checkoutDone && !cart.items.length ? (
                  <div className="checkout-success">
                    <div>
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
                    <div className="receipt-print-details">
                      <h3>
                        {member.organizationName} · {selectedBranch?.name}
                      </h3>
                      {checkoutDone.payload.items.map((item, i) => (
                        <div key={i}>
                          {item.name}
                          <span>
                            {item.quantity} {item.unitName} ·{" "}
                            {money(item.lineTotal)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <small>
                      {practice
                        ? "Practice record"
                        : (checkoutDone.receipt ??
                          checkoutDone.id.slice(0, 8))}{" "}
                      · Saved on this PC
                    </small>
                    <Button variant="outline" onClick={() => window.print()}>
                      Print sale record
                    </Button>
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
                        disabled={busy || installingUpdate}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="receipt-empty">
                    <ShoppingBasket size={38} strokeWidth={1.2} />
                    <h3>Ready for the first item.</h3>
                    <p>Select a product to start a sale.</p>
                  </div>
                )}
                <form className="payment-form" onSubmit={finishSale}>
                  <div className="subtotal">
                    <span>Subtotal</span>
                    <span>{money(grandTotal)}</span>
                  </div>
                  <div className="amount-due">
                    <span>Amount due</span>
                    <strong>{money(grandTotal)}</strong>
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
                      required
                    />
                  </Field>
                  <div className="cash-shortcuts">
                    {[
                      grandTotal,
                      Math.ceil(grandTotal / 10000) * 10000,
                      Math.ceil(grandTotal / 50000) * 50000,
                    ]
                      .filter((v, i, a) => v > 0 && a.indexOf(v) === i)
                      .map((v, i) => (
                        <button
                          type="button"
                          key={v}
                          onClick={() => setCash((v / 100).toFixed(2))}
                        >
                          {i === 0 ? "Exact" : money(v)}
                        </button>
                      ))}
                  </div>
                  <div className="change">
                    <span>Change</span>
                    <strong>{money(change)}</strong>
                  </div>
                  {Object.keys(cart.quantityErrors).length > 0 && (
                    <p className="quantity-error" role="alert">
                      Check quantities and confirm weighed amounts before
                      checkout.
                    </p>
                  )}
                  <Button
                    type="submit"
                    disabled={
                      busy ||
                      installingUpdate ||
                      !lease ||
                      !cart.items.length ||
                      Object.keys(cart.quantityErrors).length > 0 ||
                      isStock
                    }
                    className="complete-sale"
                  >
                    {savingSale ? "Saving sale…" : "Complete cash sale"}
                    <ArrowRight size={18} />
                  </Button>
                  <span className="payment-note">
                    <ShieldCheck size={13} />
                    {practice
                      ? "Practice sales never upload"
                      : "Saved on this PC before checkout completes"}
                  </span>
                </form>
              </aside>
              <div className="mobile-basket">
                <div>
                  <span>
                    {cart.items.length}{" "}
                    {cart.items.length === 1 ? "item" : "items"} · Amount due
                  </span>
                  <strong>{money(grandTotal)}</strong>
                </div>
                <a className="button" href="#current-sale">
                  Review sale <ArrowRight size={17} />
                </a>
              </div>
            </div>
          )}

          {view === "overview" && (
            <>
              <div className="summary-strip">
                <div>
                  <span>Recorded sales · all branches</span>
                  <strong>{money(Number(summary.grossSales ?? 0))}</strong>
                  <small>
                    {Number(summary.transactions ?? 0)} completed transactions
                  </small>
                </div>
                <div>
                  <span>Cash refunds</span>
                  <strong>{money(Number(summary.refunds ?? 0))}</strong>
                  <small>Linked to the original sale</small>
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
                          {money(
                            Number(
                              branchTotals.find((t) => t.branchId === b.id)
                                ?.total ?? 0,
                            ),
                          )}
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
                  <h2>Needs a closer look</h2>
                  {(cloud.audit_events ?? []).filter(
                    (a) =>
                      a.action === "record_sale" &&
                      Array.isArray(
                        (a.details as { flags?: unknown[] })?.flags,
                      ) &&
                      (a.details as { flags: unknown[] }).flags.length,
                  ).length ? (
                    <ul className="attention-list">
                      {(cloud.audit_events ?? [])
                        .filter(
                          (a) =>
                            a.action === "record_sale" &&
                            (a.details as { flags?: string[] })?.flags?.length,
                        )
                        .map((a) => (
                          <li key={str(a, "id")}>
                            <ShieldCheck size={19} />
                            <div>
                              <strong>
                                {(a.details as { flags: string[] }).flags
                                  .join(", ")
                                  .replaceAll("_", " ")}
                              </strong>
                              <small>
                                {branchName(a.branch_id)} · {when(a.created_at)}
                              </small>
                            </div>
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <Empty
                      icon={ClipboardCheck}
                      title="No flagged transactions"
                      body="Price conflicts and stock shortages will appear here for investigation."
                    />
                  )}
                </section>
              </div>
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
                            : money(Number(sh.expected_cash))}
                        </td>
                        <td>
                          {sh.counted_cash === null
                            ? "Not counted"
                            : money(Number(sh.counted_cash))}
                        </td>
                        <td>
                          {sh.counted_cash === null || sh.expected_cash === null
                            ? "Needs reconciliation"
                            : money(
                                Number(sh.counted_cash) -
                                  Number(sh.expected_cash),
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
            </>
          )}

          {view === "inventory" && (
            <>
              <section className="panel">
                <div className="section-heading">
                  <h2>{products.length} catalog products</h2>
                  <span className="muted">
                    {selectedBranch?.name} · quantities in base units
                  </span>
                </div>
                {products.length ? (
                  table(
                    [
                      "Product",
                      "Category",
                      "On hand",
                      "Selling units & price",
                      "Batch / expiry",
                    ],
                    products.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <strong>{p.name}</strong>
                          <small>{p.sku}</small>
                        </td>
                        <td>{p.category}</td>
                        <td className="numeric">
                          {[...stock.entries()]
                            .filter(([k]) => k.startsWith(p.id + ":"))
                            .reduce((n, [, v]) => n.plus(v), new Decimal(0))
                            .toString()}{" "}
                          {p.baseUnit}
                        </td>
                        <td>
                          {p.units.map((u) => (
                            <div key={u.id}>
                              {u.name} · {money(u.price)}
                            </div>
                          ))}
                        </td>
                        <td>
                          {p.batches.length
                            ? p.batches.map((b) => (
                                <div key={b.id}>
                                  {b.lot} · {b.expiresOn ?? "No expiry"}
                                </div>
                              ))
                            : "No batches"}
                        </td>
                      </tr>
                    )),
                  )
                ) : (
                  <Empty
                    title="Add your first product"
                    body="Start with the product name, base unit, selling price, and any sack conversion."
                  />
                )}
              </section>
              {isOwner && (
                <div className="two-column">
                  <section className="panel">
                    <h2>Add a product</h2>
                    <p className="muted">
                      Prices are per selling unit. Costs are snapshots for
                      margin reports.
                    </p>
                    <form
                      className="form-grid"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        void run(async () => {
                          if (practice)
                            throw new Error(
                              "Catalog changes are available after signing in to your live business.",
                            );
                          const base = inputValue(f, "baseUnit"),
                            factor = inputValue(f, "factor");
                          await command("create_product", {
                            ...context(),
                            name: inputValue(f, "name"),
                            sku: inputValue(f, "sku"),
                            category: inputValue(f, "category"),
                            baseUnit: base,
                            minimumStock: inputValue(f, "minimum"),
                            tracksExpiry: f.get("expiry") === "on",
                            units: [
                              {
                                name: inputValue(f, "unit"),
                                factor,
                                price: cents(inputValue(f, "price")),
                                cost: cents(inputValue(f, "cost")),
                              },
                              ...(factor !== "1"
                                ? [
                                    {
                                      name:
                                        base === "kg"
                                          ? "Kilo"
                                          : base === "liter"
                                            ? "Liter"
                                            : "Piece",
                                      factor: "1",
                                      price: cents(inputValue(f, "basePrice")),
                                      cost: Math.round(
                                        cents(inputValue(f, "cost")) /
                                          Number(factor),
                                      ),
                                    },
                                  ]
                                : []),
                            ],
                          });
                          if (lease) await sync();
                          else
                            await applySnapshot(
                              db,
                              await command<Snapshot>("snapshot", {
                                ...context(),
                                transactionIds: [],
                              }),
                            );
                          notify("Product added.");
                        });
                      }}
                    >
                      <Field label="Product name">
                        <input name="name" required />
                      </Field>
                      <Field label="SKU / barcode">
                        <input name="sku" required />
                      </Field>
                      <Field label="Category">
                        <select name="category">
                          {[
                            "Feeds",
                            "Fertilizers",
                            "Seeds",
                            "Tools",
                            "Soil care",
                            "Animal care",
                            "Other",
                          ].map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Base stock unit">
                        <select name="baseUnit">
                          <option value="kg">Kilogram</option>
                          <option value="liter">Liter</option>
                          <option value="piece">Piece</option>
                        </select>
                      </Field>
                      <Field label="Selling unit name">
                        <input
                          name="unit"
                          defaultValue="Sack (50 kg)"
                          required
                        />
                      </Field>
                      <Field label="Base units per selling unit">
                        <input
                          name="factor"
                          type="number"
                          min="0.000001"
                          step="0.000001"
                          defaultValue="50"
                          required
                        />
                      </Field>
                      <Field label="Selling price (₱)">
                        <input
                          name="price"
                          type="number"
                          min="0"
                          step="0.01"
                          required
                        />
                      </Field>
                      <Field label="Cost per selling unit (₱)">
                        <input
                          name="cost"
                          type="number"
                          min="0"
                          step="0.01"
                          required
                        />
                      </Field>
                      <Field label="Loose kilo / liter / piece price (₱)">
                        <input
                          name="basePrice"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue="0"
                        />
                      </Field>
                      <Field label="Low stock threshold (base units)">
                        <input
                          name="minimum"
                          type="number"
                          min="0"
                          step="0.000001"
                          defaultValue="0"
                        />
                      </Field>
                      <label className="checkbox">
                        <input name="expiry" type="checkbox" />
                        Track lots and expiration
                      </label>
                      <Button disabled={busy || !online || practice}>
                        Add product
                      </Button>
                    </form>
                  </section>
                  <section className="panel">
                    <h2>Change a selling price</h2>
                    <p className="muted">
                      Old price versions remain available to validate sales made
                      offline.
                    </p>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        void run(async () => {
                          await command("set_price", {
                            ...context(),
                            unitId: inputValue(f, "unit"),
                            price: cents(inputValue(f, "price")),
                            cost: cents(inputValue(f, "cost")),
                          });
                          if (lease) await sync();
                          notify("New price version recorded.");
                        });
                      }}
                    >
                      <Field label="Product and selling unit">
                        <select name="unit" required>
                          {products.flatMap((p) =>
                            p.units.map((u) => (
                              <option key={u.id} value={u.id}>
                                {p.name} · {u.name}
                              </option>
                            )),
                          )}
                        </select>
                      </Field>
                      <Field label="New price (₱)">
                        <input
                          name="price"
                          type="number"
                          min="0"
                          step="0.01"
                          required
                        />
                      </Field>
                      <Field label="Current cost (₱)">
                        <input
                          name="cost"
                          type="number"
                          min="0"
                          step="0.01"
                          required
                        />
                      </Field>
                      <Button disabled={busy || !online || practice}>
                        Save price version
                      </Button>
                    </form>
                  </section>
                </div>
              )}
            </>
          )}

          {view === "receiving" && (
            <>
              <div className="two-column">
                <section className="panel">
                  <h2>Receive a delivery</h2>
                  <p className="muted">
                    Record actual goods received. Each receipt creates stock
                    journal entries.
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
                        await onlineOperation(
                          db,
                          member.userId,
                          "receive_stock",
                          {
                            ...context(),
                            reference: inputValue(f, "reference"),
                            source: "purchase",
                            supplierId: inputValue(f, "supplier") || null,
                            items: [
                              {
                                productId: p.id,
                                unitId: inputValue(f, "unit"),
                                quantity: inputValue(f, "quantity"),
                                lot: inputValue(f, "lot"),
                                expiresOn: inputValue(f, "expires") || null,
                              },
                            ],
                          },
                          "receiptId",
                        );
                        await applySnapshot(
                          db,
                          await command<Snapshot>("snapshot", {
                            ...context(),
                            transactionIds: sales.map((s) => s.id),
                          }),
                        );
                        form.reset();
                        notify("Delivery received and stock updated.");
                      });
                    }}
                  >
                    <Field label="Supplier">
                      <select name="supplier">
                        <option value="">No supplier selected</option>
                        {(cloud.suppliers ?? []).map((r) => (
                          <option key={str(r, "id")} value={str(r, "id")}>
                            {str(r, "name")}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Delivery / invoice reference">
                      <input name="reference" required />
                    </Field>
                    <Field label="Product and unit">
                      <select name="unit" required>
                        {products.flatMap((p) =>
                          p.units.map((u) => (
                            <option key={u.id} value={u.id}>
                              {p.name} · {u.name}
                            </option>
                          )),
                        )}
                      </select>
                    </Field>
                    <Field label="Quantity received">
                      <input
                        name="quantity"
                        type="number"
                        min="0.000001"
                        step="0.000001"
                        required
                      />
                    </Field>
                    <div className="form-grid">
                      <Field label="Lot / batch">
                        <input name="lot" />
                      </Field>
                      <Field label="Expiry date">
                        <input name="expires" type="date" />
                      </Field>
                    </div>
                    <Button
                      disabled={
                        busy || !online || practice || member.role === "cashier"
                      }
                    >
                      Receive stock
                      <ArrowDownToLine size={16} />
                    </Button>
                  </form>
                </section>
                <div>
                  <section className="panel">
                    <h2>Suppliers</h2>
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
                        const f = new FormData(e.currentTarget);
                        void run(async () => {
                          await command("create_supplier", {
                            ...context(),
                            name: inputValue(f, "name"),
                            contact: inputValue(f, "contact"),
                          });
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
                    <section className="panel">
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
                            const { parseOpeningCSV } =
                              await import("../lib/import");
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
                              await applySnapshot(
                                db,
                                await command<Snapshot>("snapshot", {
                                  ...context(),
                                  transactionIds: sales.map((s) => s.id),
                                }),
                              );
                              notify(
                                "Opening stock imported. Verify the Inventory totals before selling.",
                              );
                              setOpeningImport(undefined);
                            });
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
                <HistoryRegister
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
                </HistoryRegister>
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
                    {
                      label: "Product",
                      value: (r) => productName(r.product_id),
                    },
                    { label: "From", value: (r) => branchName(r.branch_id) },
                    {
                      label: "To",
                      value: (r) => branchName(r.destination_branch_id),
                    },
                    { label: "Base quantity", value: (r) => r.quantity },
                    { label: "State", value: (r) => r.state },
                    { label: "Dispatched at", value: (r) => r.dispatched_at },
                    { label: "Received at", value: (r) => r.received_at },
                  ]}
                >
                  {(records) =>
                    table(
                      [
                        "Product",
                        "From → to",
                        "Base quantity",
                        "Status",
                        "Action",
                      ],
                      records.map((t) => (
                        <tr key={str(t, "id")}>
                          <td>{productName(t.product_id)}</td>
                          <td>
                            {branchName(t.branch_id)} →{" "}
                            {branchName(t.destination_branch_id)}
                          </td>
                          <td>{str(t, "quantity")}</td>
                          <td>
                            <span className="status-tag">
                              {str(t, "state").replaceAll("_", " ")}
                            </span>
                          </td>
                          <td>
                            {t.state === "in_transit" &&
                              t.destination_branch_id === branchId && (
                                <Button
                                  size="sm"
                                  disabled={!online || busy || practice}
                                  onClick={() =>
                                    void run(async () => {
                                      await command("receive_transfer", {
                                        ...context(),
                                        transferId: t.id,
                                      });
                                      if (lease) await sync();
                                      notify("Transfer received.");
                                    })
                                  }
                                >
                                  Confirm receipt
                                </Button>
                              )}
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
                    const f = new FormData(e.currentTarget);
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
                      if (lease) await sync();
                      notify(
                        "Stock dispatched. It remains in transit until received.",
                      );
                    });
                  }}
                >
                  <StockSelect products={products} />
                  <Field label="Destination branch">
                    <select name="destination" required>
                      {branchList
                        .filter((b) => b.id !== branchId)
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Quantity in base units (kg / liter / piece)">
                    <input
                      name="quantity"
                      type="number"
                      min="0.000001"
                      step="0.000001"
                      required
                    />
                  </Field>
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

          {view === "counts" && (
            <>
              <div className="information">
                <ClipboardCheck size={20} />
                <span>
                  Close the branch’s cashier shift and synchronize its sales
                  before counting. Stock changes after a count require a fresh
                  count before approval.
                </span>
              </div>
              {!practice && (
                <HistoryRegister
                  {...historyProps}
                  key={`counts:${member.organizationId}:${branchId}`}
                  title="Count register"
                  kind="counts"
                  emptyTitle="No counts recorded"
                  columns={[
                    { label: "ID", value: (r) => r.id },
                    {
                      label: "Product",
                      value: (r) => productName(r.product_id),
                    },
                    { label: "Expected", value: (r) => r.expected },
                    { label: "Counted", value: (r) => r.counted },
                    { label: "State", value: (r) => r.state },
                    { label: "Reason", value: (r) => r.reason },
                    { label: "Recorded at", value: (r) => r.created_at },
                  ]}
                >
                  {(records) =>
                    table(
                      [
                        "Product",
                        "Expected",
                        "Counted",
                        "Difference",
                        "Status",
                        "Action",
                      ],
                      records.map((c) => (
                        <tr key={str(c, "id")}>
                          <td>{productName(c.product_id)}</td>
                          <td>{str(c, "expected")}</td>
                          <td>{str(c, "counted")}</td>
                          <td>
                            {new Decimal(str(c, "counted"))
                              .minus(str(c, "expected"))
                              .toString()}
                          </td>
                          <td>{str(c, "state")}</td>
                          <td>
                            {isOwner && c.state === "pending" && (
                              <Button
                                size="sm"
                                disabled={
                                  !online ||
                                  busy ||
                                  practice ||
                                  !!pending.length
                                }
                                onClick={() =>
                                  void run(async () => {
                                    await command("approve_count", {
                                      ...context(),
                                      countId: c.id,
                                    });
                                    notify(
                                      "Count approved. The discrepancy is recorded as an adjustment.",
                                    );
                                  })
                                }
                              >
                                Approve adjustment
                              </Button>
                            )}
                          </td>
                        </tr>
                      )),
                      "counts",
                    )
                  }
                </HistoryRegister>
              )}
              <section className="panel narrow-panel">
                <h2>Submit a physical count</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    const [productId, batchId] = inputValue(f, "stock").split(
                      ":",
                    );
                    void run(async () => {
                      await onlineOperation(
                        db,
                        member.userId,
                        "submit_count",
                        {
                          ...context(),
                          productId,
                          batchId: batchId === "none" ? null : batchId,
                          counted: inputValue(f, "quantity"),
                          reason: inputValue(f, "reason"),
                        },
                        "countId",
                      );
                      notify(
                        "Count saved for owner review. No stock has been adjusted.",
                      );
                    });
                  }}
                >
                  <StockSelect products={products} />
                  <Field label="Physical quantity in base units">
                    <input
                      name="quantity"
                      type="number"
                      min="0"
                      step="0.000001"
                      required
                    />
                  </Field>
                  <Field label="Count notes / reason">
                    <textarea
                      name="reason"
                      required
                      minLength={3}
                      placeholder="What did you count, and what needs investigation?"
                    />
                  </Field>
                  <Button
                    disabled={
                      !online ||
                      busy ||
                      practice ||
                      member.role === "cashier" ||
                      !!pending.length
                    }
                  >
                    Submit count for approval
                  </Button>
                </form>
              </section>
            </>
          )}

          {view === "sales" && (
            <section className="panel">
              <h2>{selectedBranch?.name} · cash sales</h2>
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
                        <td>{money(s.payload.total)}</td>
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
                        <td>{money(Number(s.total))}</td>
                        <td>{money(Number(s.cash_received))}</td>
                        <td>{when(s.occurred_at)}</td>
                        <td>
                          {s.sale_reversals &&
                          (!Array.isArray(s.sale_reversals) ||
                            s.sale_reversals.length > 0) ? (
                            <span className="status-tag">Refunded</span>
                          ) : (
                            isOwner && (
                              <ApprovalForm
                                action="Full refund"
                                label="Refund reason"
                                description={`Return ${money(Number(s.total))} in cash and restore this sale’s stock to ${selectedBranch?.name}. The original receipt is preserved.`}
                                confirmLabel="Confirm full refund"
                                disabled={
                                  !online || busy || !lease || !!pending.length
                                }
                                onConfirm={(reason) =>
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
                                      },
                                      "refundId",
                                    );
                                    await sync();
                                    notify(
                                      "Refund recorded as a linked reversal. Original sale retained.",
                                    );
                                  })
                                }
                              />
                            )
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
              <div className="sync-summary">
                <div className="sync-illustration">
                  {online ? <RefreshCw size={32} /> : <CloudOff size={32} />}
                </div>
                <div>
                  <h2>
                    {practice
                      ? "Practice records stay on this PC"
                      : pending.length
                        ? `${pending.length} sales waiting for confirmation`
                        : "Your local queue is clear"}
                  </h2>
                  <p>
                    {practice
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
              </div>
              <section className="panel">
                <h2>Saved transaction queue</h2>
                {sales.length ? (
                  table(
                    ["Transaction", "Amount", "Status", "Details", "Recovery"],
                    sales.map((s) => (
                      <tr key={s.id}>
                        <td>
                          {s.receipt ?? s.id.slice(0, 8)}
                          <small>{when(s.payload.occurredAt)}</small>
                        </td>
                        <td>{money(s.payload.total)}</td>
                        <td>
                          <span
                            className={`status-tag ${s.status === "synced" ? "good" : s.status === "review_required" ? "warn" : ""}`}
                          >
                            {practice
                              ? "Practice · local"
                              : s.status.replaceAll("_", " ")}
                          </span>
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
                                  await applySnapshot(
                                    db,
                                    await command<Snapshot>("snapshot", {
                                      ...context(),
                                      deviceId: lease?.deviceId,
                                      transactionIds: [
                                        s.id,
                                        ...pending.map((p) => p.id),
                                      ],
                                    }),
                                  );
                                  notify(
                                    "Recovered sale approved. Original cashier, sale, and owner approval are preserved.",
                                  );
                                })
                              }
                            />
                          )}
                        </td>
                      </tr>
                    )),
                  )
                ) : (
                  <Empty
                    icon={RefreshCw}
                    title="No local transactions yet"
                    body="Every completed checkout remains listed here, including failed uploads."
                  />
                )}
              </section>
              {operations.length > 0 && (
                <section className="panel">
                  <h2>Online operations awaiting confirmation</h2>
                  {operations.map((op) => (
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
                            await retryOperation(db, member.userId, op);
                            notify("Original operation confirmed.");
                          })
                        }
                      >
                        Retry original request
                      </Button>
                    </div>
                  ))}
                </section>
              )}
              <div className="recovery-actions">
                <Field label="Restore a recovery file">
                  <input
                    type="file"
                    accept="application/json,.json"
                    disabled={!lease || busy}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      void run(async () => {
                        const count = await importRecovery(
                          db,
                          JSON.parse(await file.text()),
                        );
                        notify(
                          `${count} records checked and restored. Original transaction IDs are retained.`,
                        );
                      });
                    }}
                  />
                </Field>
                <Button
                  variant="outline"
                  onClick={() =>
                    void exportRecovery(db, {
                      organizationId: member.organizationId,
                      branchId,
                      cashierId: isOwner ? undefined : member.userId,
                    })
                      .then((data) =>
                        download(
                          `agristore-${practice ? "practice" : "recovery"}-${Date.now()}.json`,
                          data,
                        ),
                      )
                      .catch(fail)
                  }
                >
                  <ArrowDownToLine size={16} />
                  Export recovery file
                </Button>
                <p>
                  Contains transaction records. Keep this file private. Pending
                  sales are retained when you sign out.
                </p>
              </div>
            </>
          )}

          {view === "settings" && (
            <>
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
                          <dt>Offline authorization until</dt>
                          <dd>
                            {when(new Date(lease.expiresAt).toISOString())}
                          </dd>
                        </div>
                        <div>
                          <dt>Unconfirmed local sales</dt>
                          <dd>{pending.length}</dd>
                        </div>
                      </dl>
                      <Button
                        variant="outline"
                        disabled={!online || busy || practice}
                        onClick={() =>
                          void run(async () => {
                            const next = await command<Lease>("renew_shift", {
                              ...context(),
                              deviceId: lease.deviceId,
                            });
                            await setSetting(db, "lease", next);
                            setLease(next);
                            notify("Shift authorization renewed for 12 hours.");
                          })
                        }
                      >
                        Renew offline authorization
                      </Button>
                      <form
                        className="spaced-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const f = new FormData(e.currentTarget);
                          void run(async () => {
                            if (pending.length)
                              throw new Error(
                                "Synchronize every saved sale before closing the shift.",
                              );
                            const result = await command<Row>("close_shift", {
                              ...context(),
                              shiftId: lease.shiftId,
                              countedCash: cents(inputValue(f, "cash")),
                            });
                            await db.settings.delete("lease");
                            setLease(undefined);
                            cart.clear();
                            notify(
                              `Shift closed. Expected cash ${money(Number(result.expected_cash))}; counted ${money(Number(result.counted_cash))}.`,
                            );
                          });
                        }}
                      >
                        <Field label="Cash counted in drawer (₱)">
                          <input
                            name="cash"
                            type="number"
                            min="0"
                            step="0.01"
                            required
                          />
                        </Field>
                        <Button
                          disabled={
                            !online || busy || practice || !!pending.length
                          }
                        >
                          Reconcile & close shift
                        </Button>
                      </form>
                    </>
                  ) : (
                    <p className="muted">
                      No cashier shift is open. Open one from Checkout.
                    </p>
                  )}
                </section>
                <section className="panel">
                  <h2>Application & recovery</h2>
                  <p className="muted">
                    Install AgriStore from Edge’s app menu after opening your
                    shift online. Keep this dedicated browser profile and its
                    site data.
                  </p>
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
                          ? "Installed"
                          : registration
                            ? "Installing…"
                            : "Available in production build"}
                      </dd>
                    </div>
                  </dl>
                  <Button
                    variant="outline"
                    onClick={() =>
                      void exportRecovery(db, {
                        organizationId: member.organizationId,
                        branchId,
                        cashierId: isOwner ? undefined : member.userId,
                      })
                        .then((d) =>
                          download(`agristore-recovery-${Date.now()}.json`, d),
                        )
                        .catch(fail)
                    }
                  >
                    Export local recovery file
                  </Button>
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
                            "No new download is available. If an earlier update is not visible, close and reopen AgriStore. Keep this browser's site data.",
                          );
                          notify("No new app download is available.");
                          return;
                        }
                        const canRestart = async () => {
                          const [sales, operations] = await Promise.all([
                            db.sales.where("status").notEqual("synced").count(),
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
                            "Update downloaded. Installing it before reopening AgriStore…",
                          );
                          const result = await activateReadyUpdate(
                            waiting,
                            canRestart,
                            () => {
                              setUpdateFeedback(
                                "Update installed. Reopening AgriStore… If this window stays open, close it and reopen AgriStore. Keep this browser's site data.",
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
                              "Update ready. Finish checkout and confirm every pending record before reopening AgriStore.",
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
                    {table(
                      ["PC", "Branch", "Status", "Last sync", "Action"],
                      (cloud.devices ?? []).map((d) => (
                        <tr key={str(d, "id")}>
                          <td>{str(d, "name")}</td>
                          <td>{branchName(d.branch_id)}</td>
                          <td>{d.active ? "Active" : "Retired"}</td>
                          <td>{when(d.last_sync)}</td>
                          <td>
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
                    <h2>Branches</h2>
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
                  </section>
                </>
              )}
            </>
          )}
        </main>
        <footer className="workspace-footer">
          <span>
            <Sprout size={14} />
            AgriStore POS
          </span>
          <span>
            {practice
              ? "Sample data · local practice"
              : `${selectedBranch?.code ?? "Select a branch"} · Cash sales only`}
            <span className="footer-dot">·</span>Not a tax invoice system
          </span>
        </footer>
      </div>
    </div>
  );
}

function StockSelect({ products }: { products: Product[] }) {
  return (
    <Field label="Product / batch">
      <select name="stock" required>
        {products.flatMap((p) =>
          p.batches.length
            ? p.batches.map((b) => (
                <option key={b.id} value={`${p.id}:${b.id}`}>
                  {p.name} · {b.lot} ({p.baseUnit})
                </option>
              ))
            : [
                <option key={p.id} value={`${p.id}:none`}>
                  {p.name} ({p.baseUnit})
                </option>,
              ],
        )}
      </select>
    </Field>
  );
}
