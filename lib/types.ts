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
}
export interface Settings { monthlyLimitPaise: number | null; lastBackupAt: string | null }
export const DEFAULT_SETTINGS: Settings = { monthlyLimitPaise: null, lastBackupAt: null };
