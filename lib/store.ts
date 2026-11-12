// Everything is saved in the browser's IndexedDB on this phone. Nothing is sent anywhere.
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Category } from "./categories";
import { sortRows } from "./totals";
import type { Debt } from "./debts";
import { DEFAULT_SETTINGS, type CategoryLimits, type Expense, type Repeat, type Settings } from "./types";
import type { Account, Goal, Holding, Transfer } from "./wealth";
import type { PlanItem } from "./plan";

interface Schema extends DBSchema {
  expenses: { key: string; value: Expense; indexes: { date: string } };
  learned: { key: string; value: { word: string; category: Category } };
  settings: { key: string; value: unknown };
  repeats: { key: string; value: Repeat };
  debts: { key: string; value: Debt };
  accounts: { key: string; value: Account };
  transfers: { key: string; value: Transfer };
  holdings: { key: string; value: Holding };
  goals: { key: string; value: Goal };
  photos: { key: string; value: { id: string; blob: Blob } };
  plan: { key: string; value: PlanItem };
}

let dbp: Promise<IDBPDatabase<Schema>> | null = null;
function db() {
  // The database name stays neutral so the app can be renamed without losing anyone's data.
  dbp ??= openDB<Schema>("expenses", 5, {
    upgrade(d, old) {
      if (old < 1) {
        d.createObjectStore("expenses", { keyPath: "id" }).createIndex("date", "date");
        d.createObjectStore("learned", { keyPath: "word" });
        d.createObjectStore("settings");
      }
      if (old < 2) d.createObjectStore("repeats", { keyPath: "id" }); // monthly repeats (v2)
      if (old < 3) d.createObjectStore("debts", { keyPath: "id" }); // lent and borrowed (v3)
      if (old < 4) { // accounts, transfers, net worth, goals, receipt photos (v4)
        for (const n of ["accounts", "transfers", "holdings", "goals", "photos"] as const) d.createObjectStore(n, { keyPath: "id" });
      }
      if (old < 5) d.createObjectStore("plan", { keyPath: "id" }); // monthly payments (v5)
    },
    // Another tab opened a newer version: step aside so it can upgrade; the next call here reopens.
    blocking() { void dbp?.then(x => x.close()); dbp = null; },
  });
  return dbp;
}

/** Asks the browser not to clear our data when the phone runs low on space. Safe to call often. */
export async function keepData(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    return (await navigator.storage.persisted()) || (await navigator.storage.persist());
  } catch { return false; }
}

export const newId = () => crypto.randomUUID();

export async function allExpenses(): Promise<Expense[]> {
  return sortRows(await (await db()).getAll("expenses"));
}
export async function putExpense(e: Expense) { await (await db()).put("expenses", e); }
export async function deleteExpense(id: string) { await (await db()).delete("expenses", id); }

export async function learnedMap(): Promise<Map<string, Category>> {
  const rows = await (await db()).getAll("learned");
  return new Map(rows.map(r => [r.word, r.category]));
}
export async function learn(word: string, category: Category) { await (await db()).put("learned", { word, category }); }

export async function getSettings(): Promise<Settings> {
  const d = await db();
  const [limit, last, cats, ss, sp, ua, ca] = await Promise.all(["monthlyLimitPaise", "lastBackupAt", "categoryLimits", "seniorSelf", "seniorParents", "upiAccount", "cashAccount"].map(k => d.get("settings", k)));
  return {
    monthlyLimitPaise: typeof limit === "number" ? limit : DEFAULT_SETTINGS.monthlyLimitPaise,
    lastBackupAt: typeof last === "string" ? last : DEFAULT_SETTINGS.lastBackupAt,
    categoryLimits: cats && typeof cats === "object" ? (cats as CategoryLimits) : {},
    seniorSelf: ss === true,
    seniorParents: sp === true,
    upiAccount: typeof ua === "string" ? ua : null,
    cashAccount: typeof ca === "string" ? ca : null,
  };
}
export async function saveSettings(s: Partial<Settings>) {
  const tx = (await db()).transaction("settings", "readwrite");
  for (const [k, v] of Object.entries(s)) await tx.store.put(v, k);
  await tx.done;
}

export async function allRepeats(): Promise<Repeat[]> { return (await db()).getAll("repeats"); }
export async function putRepeat(r: Repeat) { await (await db()).put("repeats", r); }
export async function deleteRepeat(id: string) { await (await db()).delete("repeats", id); }

/**
 * Adds due monthly entries and moves their rules forward, in one transaction.
 * An entry id that already exists is left alone (another tab got there first, or it was edited).
 * Returns the entries actually added.
 */
export async function applyDue(entries: Expense[], rules: Repeat[]): Promise<Expense[]> {
  const tx = (await db()).transaction(["expenses", "repeats"], "readwrite");
  const added: Expense[] = [];
  for (const r of rules) {
    const cur = await tx.objectStore("repeats").get(r.id);
    if (cur && cur.lastMonth < r.lastMonth) await tx.objectStore("repeats").put({ ...cur, lastMonth: r.lastMonth });
  }
  for (const e of entries) {
    if (await tx.objectStore("expenses").get(e.id)) continue;
    await tx.objectStore("expenses").add(e);
    added.push(e);
  }
  await tx.done;
  return added;
}

export async function allDebts(): Promise<Debt[]> { return (await db()).getAll("debts"); }
export async function putDebt(x: Debt) { await (await db()).put("debts", x); }
export async function deleteDebt(id: string) { await (await db()).delete("debts", id); }

// Accounts, transfers, holdings, goals: small lists, read whole and written one at a time.
type ListStore = "accounts" | "transfers" | "holdings" | "goals" | "plan";
export async function all<S extends ListStore>(s: S): Promise<Schema[S]["value"][]> { return (await db()).getAll(s); }
export async function put<S extends ListStore>(s: S, v: Schema[S]["value"]) { await (await db()).put(s, v); }
export async function del(s: ListStore, id: string) { await (await db()).delete(s, id); }

export async function getPhoto(id: string): Promise<Blob | null> { return (await (await db()).get("photos", id))?.blob ?? null; }
export async function putPhoto(id: string, blob: Blob) { await (await db()).put("photos", { id, blob }); }
export async function deletePhoto(id: string) { await (await db()).delete("photos", id); }
export async function allPhotos() { return (await db()).getAll("photos"); }

/** Adds due auto-pay entries and moves the items forward, in one transaction (an id already there is left alone). */
export async function applyPlanDue(entries: Expense[], items: PlanItem[]): Promise<Expense[]> {
  const tx = (await db()).transaction(["expenses", "plan"], "readwrite");
  const added: Expense[] = [];
  for (const it of items) {
    const cur = await tx.objectStore("plan").get(it.id);
    if (cur && (!cur.handledThrough || (it.handledThrough && cur.handledThrough < it.handledThrough))) await tx.objectStore("plan").put({ ...cur, handledThrough: it.handledThrough });
  }
  for (const e of entries) { if (await tx.objectStore("expenses").get(e.id)) continue; await tx.objectStore("expenses").add(e); added.push(e); }
  await tx.done;
  return added;
}

/** One-time move of old "Every month" repeats into Payments: same ids, then the repeat rules are removed. */
export async function migrateRepeats(items: PlanItem[]) {
  const tx = (await db()).transaction(["plan", "repeats"], "readwrite");
  for (const it of items) { if (!(await tx.objectStore("plan").get(it.id))) await tx.objectStore("plan").put(it); await tx.objectStore("repeats").delete(it.id); }
  await tx.done;
}

/** Writes a restore in one transaction: either every row lands or none do. */
export interface RestoreExtra { accounts?: Account[]; transfers?: Transfer[]; holdings?: Holding[]; goals?: Goal[]; plan?: PlanItem[]; photos?: { id: string; blob: Blob }[] }
export async function applyRestore(rows: Expense[], learned: { word: string; category: Category }[], repeats: Repeat[] = [], debts: Debt[] = [], extra: RestoreExtra = {}) {
  const tx = (await db()).transaction(["expenses", "learned", "repeats", "debts", "accounts", "transfers", "holdings", "goals", "plan", "photos"], "readwrite");
  // Newer copy wins for anything with updatedAt; photos are added when missing.
  for (const s of ["accounts", "transfers", "holdings", "goals", "plan"] as const) {
    for (const x of (extra[s] ?? []) as { id: string; updatedAt: string }[]) {
      const cur = (await tx.objectStore(s).get(x.id)) as { updatedAt: string } | undefined;
      if (!cur || cur.updatedAt < x.updatedAt) await tx.objectStore(s).put(x as never);
    }
  }
  for (const p of extra.photos ?? []) if (!(await tx.objectStore("photos").get(p.id))) await tx.objectStore("photos").put(p);
  for (const x of debts) {
    const cur = await tx.objectStore("debts").get(x.id);
    if (!cur || cur.updatedAt < x.updatedAt) await tx.objectStore("debts").put(x);
  }
  for (const r of rows) await tx.objectStore("expenses").put(r);
  for (const l of learned) await tx.objectStore("learned").put(l);
  for (const r of repeats) {
    const cur = await tx.objectStore("repeats").get(r.id);
    if (!cur || cur.lastMonth < r.lastMonth) await tx.objectStore("repeats").put(r);
  }
  await tx.done;
}

/** For tests only. */
export async function _wipe() {
  const d = await db();
  await Promise.all([d.clear("expenses"), d.clear("learned"), d.clear("settings"), d.clear("repeats"), d.clear("debts"), ...(["accounts", "transfers", "holdings", "goals", "plan", "photos"] as const).map(n => d.clear(n))]);
}
