import { categoryLabel, kindOf, type Category } from "./categories";
import type { Method } from "./parse";
import type { Expense } from "./types";

export interface Filter { q: string; category: Category | ""; method: Method | "none" | ""; kind: "" | "in" | "out" | "invest"; month: string }
export const EMPTY_FILTER: Filter = { q: "", category: "", method: "", kind: "", month: "" };
export const isFiltering = (f: Filter) => !!(f.q.trim() || f.category || f.method || f.kind || f.month);

/** Matches words in the note or category name, or an amount ("450", "₹450"), plus the chosen filters. */
export function filterRows(rows: Expense[], f: Filter): Expense[] {
  const words = f.q.toLowerCase().replace(/[₹,]/g, "").split(/\s+/).filter(Boolean);
  return rows.filter(e => {
    if (f.category && e.category !== f.category) return false;
    if (f.method === "none" ? e.method !== null : f.method && e.method !== f.method) return false;
    if (f.kind === "in" && kindOf(e.category) !== "in") return false;
    if (f.kind === "out" && kindOf(e.category) !== "spend") return false;
    if (f.kind === "invest" && kindOf(e.category) !== "invest") return false;
    if (f.month && !e.date.startsWith(f.month)) return false;
    if (!words.length) return true;
    const hay = `${e.note} ${categoryLabel(e.category)}`.toLowerCase();
    const amount = String(e.amountPaise / 100);
    return words.every(w => (/^\d+(\.\d+)?$/.test(w) ? amount === String(Number(w)) || hay.includes(w) : hay.includes(w)));
  });
}
