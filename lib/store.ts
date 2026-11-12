// Everything is saved in the browser's IndexedDB on this phone. Nothing is sent anywhere.
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Category } from "./categories";
import { sortRows } from "./totals";
import type { Debt } from "./debts";
import { DEFAULT_SETTINGS, type CategoryLimits, type Expense, type Repeat, type Settings } from "./types";

interface Schema extends DBSchema {
  expenses: { key: string; value: Expense; indexes: { date: string } };
  learned: { key: string; value: { word: string; category: Category } };
  settings: { key: string; value: unknown };
  repeats: { key: string; value: Repeat };
  debts: { key: string; value: Debt };
}

let dbp: Promise<IDBPDatabase<Schema>> | null = null;
function db() {
  // The database name stays neutral so the app can be renamed without losing anyone's data.
  dbp ??= openDB<Schema>("expenses", 3, {
    upgrade(d, old) {
      if (old < 1) {
        d.createObjectStore("expenses", { keyPath: "id" }).createIndex("date", "date");
        d.createObjectStore("learned", { keyPath: "word" });
        d.createObjectStore("settings");
      }
      if (old < 2) d.createObjectStore("repeats", { keyPath: "id" }); // monthly repeats (v2)
      if (old < 3) d.createObjectStore("debts", { keyPath: "id" }); // lent and borrowed (v3)
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
  const [limit, last, cats] = await Promise.all([d.get("settings", "monthlyLimitPaise"), d.get("settings", "lastBackupAt"), d.get("settings", "categoryLimits")]);
  return {
    monthlyLimitPaise: typeof limit === "number" ? limit : DEFAULT_SETTINGS.monthlyLimitPaise,
    lastBackupAt: typeof last === "string" ? last : DEFAULT_SETTINGS.lastBackupAt,
    categoryLimits: cats && typeof cats === "object" ? (cats as CategoryLimits) : {},
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

/** Writes a restore in one transaction: either every row lands or none do. */
export async function applyRestore(rows: Expense[], learned: { word: string; category: Category }[], repeats: Repeat[] = [], debts: Debt[] = []) {
  const tx = (await db()).transaction(["expenses", "learned", "repeats", "debts"], "readwrite");
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
  await Promise.all([d.clear("expenses"), d.clear("learned"), d.clear("settings"), d.clear("repeats"), d.clear("debts")]);
}
