import type { Category } from "./categories";
import type { Method } from "./parse";

export interface Expense {
  id: string;
  amountPaise: number;
  note: string;
  category: Category;
  method: Method | null;
  date: string; // YYYY-MM-DD, local
  createdAt: string; // ISO
  updatedAt: string; // ISO
  /** Set when this entry repeats every month (the rule's id). */
  repeatId?: string;
}

/** "Every month": copies an entry onto the same day each month (the last day in shorter months). */
export interface Repeat {
  id: string;
  amountPaise: number;
  note: string;
  category: Category;
  method: Method | null;
  day: number; // 1–31
  lastMonth: string; // YYYY-MM: the latest month already added
  createdAt: string;
}
export interface Settings { monthlyLimitPaise: number | null; lastBackupAt: string | null }
export const DEFAULT_SETTINGS: Settings = { monthlyLimitPaise: null, lastBackupAt: null };
