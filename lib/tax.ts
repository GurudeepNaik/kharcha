// Tax-saving deductions (old tax regime only), counted per financial year (April to March).
//
// From 1 April 2026 the Income-tax Act, 2025 renumbers the familiar sections; the limits are unchanged:
//   Section 123 (was 80C)        ₹1,50,000  PPF, EPF/VPF, ELSS, life/term insurance, NSC, Sukanya, 5-year tax-saver FD, tuition, NPS (own)
//   Section 124 (was 80CCD(1B))  ₹50,000    NPS, on top of Section 123
//   Section 126 (was 80D)        ₹25,000 for you and family (₹50,000 if a senior citizen),
//                                 + ₹25,000 for parents (₹50,000 if a senior citizen); health check-ups up to ₹5,000 within these
// Sources: secondary summaries of the Act (not the gazette text). The new regime, the default, allows none of these.
import type { Expense } from "./types";

export type TaxTag = "c" | "d" | "dp" | "nps" | "none";
export const TAX_TAGS: TaxTag[] = ["c", "nps", "d", "dp", "none"];
export const isTaxTag = (x: unknown): x is TaxTag => typeof x === "string" && (TAX_TAGS as string[]).includes(x);

export const LIMIT_C = 1_50_000_00;
export const LIMIT_NPS = 50_000_00;
export const LIMIT_CHECKUP = 5_000_00;
export const limitD = (senior: boolean) => (senior ? 50_000_00 : 25_000_00);

const has = (e: Expense, re: RegExp) => re.test(e.note.toLowerCase());
const PARENTS = /\b(parent|parents|mother|father|mom|dad|amma|appa|maa|papa|mummy)\b/;

/** What an entry most likely counts as. The person can override it on the entry. */
export function suggestTax(e: Expense): TaxTag {
  switch (e.category) {
    case "retirement": return has(e, /\bnps\b/) ? "nps" : "c";
    case "termIns": return "c";
    case "otherIns": return has(e, /\b(lic|life|endowment|ulip)\b/) ? "c" : "none";
    case "sip": return has(e, /\b(elss|tax ?saver|tax ?saving)\b/) ? "c" : "none";
    case "deposit": return has(e, /\b(tax ?saver|tax ?saving|5 ?y(ea)?r)\b/) ? "c" : "none";
    case "invest": return has(e, /\b(sukanya|ssy|nsc)\b/) ? "c" : "none";
    case "healthIns": return has(e, PARENTS) ? "dp" : "d";
    case "health": return has(e, /\b(check ?up|health check|preventive)\b/) ? (has(e, PARENTS) ? "dp" : "d") : "none";
    case "bills": return has(e, /\btuition\b/) ? "c" : "none";
    default: return "none";
  }
}
export const taxOf = (e: Expense): TaxTag => e.tax ?? suggestTax(e);

/** "2026-27" for any date from 1 April 2026 to 31 March 2027. */
export function fyOf(date: string): string {
  const y = Number(date.slice(0, 4)), m = Number(date.slice(5, 7));
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}
export const fyRange = (fy: string) => { const s = Number(fy.slice(0, 4)); return { from: `${s}-04-01`, to: `${s + 1}-03-31` }; };
export const prevFy = (fy: string) => fyOf(`${Number(fy.slice(0, 4)) - 1}-06-01`);

export interface TaxLine { tag: Exclude<TaxTag, "none">; paid: number; counted: number; limit: number; rows: Expense[] }

/**
 * Totals for a financial year. `paid` is everything tagged; `counted` is what the limits allow.
 * NPS above ₹50,000 spills into Section 123; health check-ups count up to ₹5,000 across you and parents.
 */
export function taxSummary(rows: Expense[], fy: string, senior: { self: boolean; parents: boolean }): TaxLine[] {
  const { from, to } = fyRange(fy);
  const inFy = rows.filter(e => e.date >= from && e.date <= to);
  const by = (tag: TaxTag) => inFy.filter(e => taxOf(e) === tag);
  const sum = (xs: Expense[]) => xs.reduce((s, e) => s + e.amountPaise, 0);

  const npsRows = by("nps"), npsPaid = sum(npsRows);
  const npsCounted = Math.min(npsPaid, LIMIT_NPS);
  const cRows = by("c"), cPaid = sum(cRows) + (npsPaid - npsCounted);

  // Check-ups (from the Health spend category) share one ₹5,000 allowance across both 126 lines.
  let checkupLeft = LIMIT_CHECKUP;
  const dPart = (tag: "d" | "dp") => {
    const rs = by(tag);
    let total = 0;
    for (const e of rs) {
      if (e.category === "health") { const c = Math.min(e.amountPaise, checkupLeft); checkupLeft -= c; total += c; }
      else total += e.amountPaise;
    }
    return { rs, paid: sum(rs), allowed: total };
  };
  const d = dPart("d"), dp = dPart("dp");
  const lim = { d: limitD(senior.self), dp: limitD(senior.parents) };

  return [
    { tag: "c", paid: cPaid, counted: Math.min(cPaid, LIMIT_C), limit: LIMIT_C, rows: cRows },
    { tag: "nps", paid: npsPaid, counted: npsCounted, limit: LIMIT_NPS, rows: npsRows },
    { tag: "d", paid: d.paid, counted: Math.min(d.allowed, lim.d), limit: lim.d, rows: d.rs },
    { tag: "dp", paid: dp.paid, counted: Math.min(dp.allowed, lim.dp), limit: lim.dp, rows: dp.rs },
  ];
}
