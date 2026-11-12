// Backup file, restore (with a preview of what changes) and the spreadsheet export.
import { isCategory, isIncomeCategory, categoryLabel, type Category } from "./categories";
import { validDate } from "./dates";
import { MAX_PAISE, plainAmount } from "./money";
import type { Debt } from "./debts";
import type { CategoryLimits, Expense, Repeat, Settings } from "./types";

export const BACKUP_KIND = "expense-tracker-backup";
export const BACKUP_VERSION = 3; // 2: money in, monthly repeats. 3: lent/borrowed, category budgets. Older files still restore.
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
const MAX_ROWS = 200_000;

export interface Backup {
  kind: typeof BACKUP_KIND;
  version: number;
  exportedAt: string;
  expenses: Expense[];
  learned: { word: string; category: Category }[];
  repeats: Repeat[];
  debts: Debt[];
  settings: Pick<Settings, "monthlyLimitPaise" | "categoryLimits">;
}

export function makeBackup(expenses: Expense[], learned: Map<string, Category>, settings: Settings, repeats: Repeat[] = [], debts: Debt[] = [], now = new Date()): Backup {
  return {
    kind: BACKUP_KIND, version: BACKUP_VERSION, exportedAt: now.toISOString(), expenses, repeats, debts,
    learned: [...learned].map(([word, category]) => ({ word, category })),
    settings: { monthlyLimitPaise: settings.monthlyLimitPaise, categoryLimits: settings.categoryLimits },
  };
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const ID = /^[A-Za-z0-9-]{8,64}$/;

function validExpense(x: unknown): Expense | null {
  if (!x || typeof x !== "object") return null;
  const e = x as Record<string, unknown>;
  if (typeof e.id !== "string" || !ID.test(e.id)) return null;
  if (typeof e.amountPaise !== "number" || !Number.isInteger(e.amountPaise) || e.amountPaise <= 0 || e.amountPaise > MAX_PAISE) return null;
  if (typeof e.note !== "string" || e.note.length > 60) return null;
  if (!isCategory(e.category)) return null;
  if (!(e.method === null || e.method === "upi" || e.method === "cash")) return null;
  if (typeof e.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) return null;
  const [y, m, d] = e.date.split("-").map(Number) as [number, number, number];
  if (validDate(y, m, d) !== e.date) return null;
  if (typeof e.createdAt !== "string" || !ISO.test(e.createdAt) || typeof e.updatedAt !== "string" || !ISO.test(e.updatedAt)) return null;
  if (e.repeatId !== undefined && (typeof e.repeatId !== "string" || !ID.test(e.repeatId))) return null;
  const out: Expense = { id: e.id, amountPaise: e.amountPaise, note: e.note, category: e.category, method: e.method, date: e.date, createdAt: e.createdAt, updatedAt: e.updatedAt };
  if (e.repeatId !== undefined) out.repeatId = e.repeatId;
  return out;
}

function validRepeat(x: unknown): Repeat | null {
  if (!x || typeof x !== "object") return null;
  const r = x as Record<string, unknown>;
  if (typeof r.id !== "string" || !ID.test(r.id)) return null;
  if (typeof r.amountPaise !== "number" || !Number.isInteger(r.amountPaise) || r.amountPaise <= 0 || r.amountPaise > MAX_PAISE) return null;
  if (typeof r.note !== "string" || r.note.length > 60 || !isCategory(r.category)) return null;
  if (!(r.method === null || r.method === "upi" || r.method === "cash")) return null;
  if (typeof r.day !== "number" || !Number.isInteger(r.day) || r.day < 1 || r.day > 31) return null;
  if (typeof r.lastMonth !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(r.lastMonth)) return null;
  if (typeof r.createdAt !== "string" || !ISO.test(r.createdAt)) return null;
  return { id: r.id, amountPaise: r.amountPaise, note: r.note, category: r.category, method: r.method, day: r.day, lastMonth: r.lastMonth, createdAt: r.createdAt };
}

function validDebt(x: unknown): Debt | null {
  if (!x || typeof x !== "object") return null;
  const d = x as Record<string, unknown>;
  if (typeof d.id !== "string" || !ID.test(d.id)) return null;
  if (typeof d.person !== "string" || !d.person.trim() || d.person.length > 60) return null;
  if (d.dir !== "gave" && d.dir !== "got") return null;
  if (typeof d.amountPaise !== "number" || !Number.isInteger(d.amountPaise) || d.amountPaise <= 0 || d.amountPaise > MAX_PAISE) return null;
  if (typeof d.note !== "string" || d.note.length > 60) return null;
  if (typeof d.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return null;
  const [y, m, dd] = d.date.split("-").map(Number) as [number, number, number];
  if (validDate(y, m, dd) !== d.date) return null;
  if (typeof d.createdAt !== "string" || !ISO.test(d.createdAt) || typeof d.updatedAt !== "string" || !ISO.test(d.updatedAt)) return null;
  return { id: d.id, person: d.person, dir: d.dir, amountPaise: d.amountPaise, note: d.note, date: d.date, createdAt: d.createdAt, updatedAt: d.updatedAt };
}

/** Reads a backup file's text. Every row is checked; one bad row rejects the whole file, so nothing half-loads. */
export function readBackup(text: string): { ok: true; value: Backup } | { ok: false; error: string } {
  const bad = { ok: false as const, error: "This file isn't a backup from this app, or it is damaged." };
  if (text.length > MAX_BACKUP_BYTES) return { ok: false, error: "This file is too big to be a backup." };
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return bad; }
  if (!raw || typeof raw !== "object") return bad;
  const b = raw as Record<string, unknown>;
  if (b.kind !== BACKUP_KIND || typeof b.version !== "number") return bad;
  if (b.version > BACKUP_VERSION) return { ok: false, error: "This backup is from a newer version of the app. Reload the app and try again." };
  if (!Array.isArray(b.expenses) || b.expenses.length > MAX_ROWS || !Array.isArray(b.learned)) return bad;
  const expenses: Expense[] = [];
  for (const x of b.expenses) { const e = validExpense(x); if (!e) return bad; expenses.push(e); }
  const learned: { word: string; category: Category }[] = [];
  for (const x of b.learned) {
    const l = x as Record<string, unknown>;
    if (!l || typeof l.word !== "string" || l.word.length > 40 || !isCategory(l.category)) return bad;
    learned.push({ word: l.word, category: l.category });
  }
  const repeats: Repeat[] = [];
  if (b.repeats !== undefined) {
    if (!Array.isArray(b.repeats) || b.repeats.length > 1000) return bad;
    for (const x of b.repeats) { const r = validRepeat(x); if (!r) return bad; repeats.push(r); }
  }
  const debts: Debt[] = [];
  if (b.debts !== undefined) {
    if (!Array.isArray(b.debts) || b.debts.length > MAX_ROWS) return bad;
    for (const x of b.debts) { const d = validDebt(x); if (!d) return bad; debts.push(d); }
  }
  const s = (b.settings ?? {}) as Record<string, unknown>;
  const categoryLimits: CategoryLimits = {};
  if (s.categoryLimits && typeof s.categoryLimits === "object") {
    for (const [k, v] of Object.entries(s.categoryLimits as Record<string, unknown>)) {
      if (isCategory(k) && !isIncomeCategory(k) && typeof v === "number" && Number.isInteger(v) && v > 0 && v <= MAX_PAISE) categoryLimits[k as keyof CategoryLimits] = v;
    }
  }
  const limit = s.monthlyLimitPaise;
  const monthlyLimitPaise = typeof limit === "number" && Number.isInteger(limit) && limit > 0 && limit <= MAX_PAISE ? limit : null;
  return { ok: true, value: { kind: BACKUP_KIND, version: b.version, exportedAt: String(b.exportedAt ?? ""), expenses, learned, repeats, debts, settings: { monthlyLimitPaise, categoryLimits } } };
}

/** What a restore would do: new rows, rows where the backup's copy is newer, and rows already the same or newer here. */
export function planRestore(current: Expense[], incoming: Expense[]) {
  const have = new Map(current.map(e => [e.id, e]));
  const add: Expense[] = [], update: Expense[] = [];
  let unchanged = 0;
  for (const e of incoming) {
    const h = have.get(e.id);
    if (!h) add.push(e);
    else if (e.updatedAt > h.updatedAt) update.push(e);
    else unchanged++;
  }
  return { add, update, unchanged };
}

// A cell starting with = + - @ would run as a formula in Excel; a leading apostrophe keeps it as text.
const cell = (s: string) => {
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** CSV for Excel / Google Sheets. The BOM makes Excel read ₹ and Indian scripts correctly. */
export function toCsv(rows: Expense[], debts: Debt[] = []): string {
  const lines = ["Date,Type,Amount (₹),Category,Note,Paid by"];
  const out: [string, string, string][] = [];
  for (const e of rows) {
    out.push([e.date, e.createdAt, [e.date, isIncomeCategory(e.category) ? "Money in" : "Spent", plainAmount(e.amountPaise), categoryLabel(e.category), cell(e.note), e.method === "upi" ? "UPI" : e.method === "cash" ? "Cash" : ""].join(",")]);
  }
  for (const d of debts) {
    const note = d.note ? `${d.person}: ${d.note}` : d.person;
    out.push([d.date, d.createdAt, [d.date, d.dir === "gave" ? "Gave (lent or repaid)" : "Got (borrowed or paid back)", plainAmount(d.amountPaise), "People", cell(note), ""].join(",")]);
  }
  out.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
  for (const [, , line] of out) lines.push(line);
  return "﻿" + lines.join("\r\n") + "\r\n";
}
