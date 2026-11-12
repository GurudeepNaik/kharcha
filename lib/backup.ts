// Backup file, restore (with a preview of what changes) and the spreadsheet export.
import { isCategory, isIncomeCategory, categoryLabel, type Category } from "./categories";
import { validDate } from "./dates";
import { MAX_PAISE, plainAmount } from "./money";
import type { Expense, Repeat, Settings } from "./types";

export const BACKUP_KIND = "expense-tracker-backup";
export const BACKUP_VERSION = 2; // 2 added money in and monthly repeats; version 1 files still restore
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
const MAX_ROWS = 200_000;

export interface Backup {
  kind: typeof BACKUP_KIND;
  version: number;
  exportedAt: string;
  expenses: Expense[];
  learned: { word: string; category: Category }[];
  repeats: Repeat[];
  settings: Pick<Settings, "monthlyLimitPaise">;
}

export function makeBackup(expenses: Expense[], learned: Map<string, Category>, settings: Settings, repeats: Repeat[] = [], now = new Date()): Backup {
  return {
    kind: BACKUP_KIND, version: BACKUP_VERSION, exportedAt: now.toISOString(), expenses, repeats,
    learned: [...learned].map(([word, category]) => ({ word, category })),
    settings: { monthlyLimitPaise: settings.monthlyLimitPaise },
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
  const s = (b.settings ?? {}) as Record<string, unknown>;
  const limit = s.monthlyLimitPaise;
  const monthlyLimitPaise = typeof limit === "number" && Number.isInteger(limit) && limit > 0 && limit <= MAX_PAISE ? limit : null;
  return { ok: true, value: { kind: BACKUP_KIND, version: b.version, exportedAt: String(b.exportedAt ?? ""), expenses, learned, repeats, settings: { monthlyLimitPaise } } };
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
export function toCsv(rows: Expense[]): string {
  const lines = ["Date,Type,Amount (₹),Category,Note,Paid by"];
  for (const e of [...rows].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))) {
    lines.push([e.date, isIncomeCategory(e.category) ? "Money in" : "Spent", plainAmount(e.amountPaise), categoryLabel(e.category), cell(e.note), e.method === "upi" ? "UPI" : e.method === "cash" ? "Cash" : ""].join(","));
  }
  return "﻿" + lines.join("\r\n") + "\r\n";
}
