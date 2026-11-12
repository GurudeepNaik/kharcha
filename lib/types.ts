import type { InHand } from "./inhand";
import type { Category, SpendCategory } from "./categories";
import type { TaxTag } from "./tax";
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
  /** Tax section chosen by the person; when absent, lib/tax.ts suggests one from the category and note. */
  tax?: TaxTag;
  /** Which account (cash, bank, card) the money went from or into. */
  accountId?: string;
  /** A photo of the receipt is kept for this entry (photos store, keyed by the entry id). */
  photo?: boolean;
  /** The monthly payment (Payments tab) this entry pays. */
  planId?: string;
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
export type CategoryLimits = Partial<Record<SpendCategory, number>>;
export interface Settings {
  monthlyLimitPaise: number | null; lastBackupAt: string | null; categoryLimits: CategoryLimits; seniorSelf: boolean; seniorParents: boolean;
  /** Accounts new entries use: UPI payments → upiAccount, cash → cashAccount. */
  upiAccount: string | null; cashAccount: string | null;
  /** Money in hand when you last typed it; see lib/inhand.ts. */
  inHand: InHand | null;
}
export const DEFAULT_SETTINGS: Settings = { monthlyLimitPaise: null, lastBackupAt: null, categoryLimits: {}, seniorSelf: false, seniorParents: false, upiAccount: null, cashAccount: null, inHand: null };
