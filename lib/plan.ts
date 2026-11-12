// Monthly payments: salary, loans, SIPs, insurance, bills. Each item is due on a day of the month
// (or every 3, 6 or 12 months); each month it's paid, skipped, due or overdue. Paying one creates a normal
// entry linked to the item (Expense.planId), so totals, budgets and tax keep working as before.
//
// Loans:
//  - "loan" (EMI): reducing balance. Interest of (rate / 12) on what's left is added each month on the due day;
//    payments of any size reduce it. Skipping a month just means interest piles up.
//  - "goldloan": simple interest worked out per day on the loan amount left. A payment clears interest first,
//    then the loan amount. Pay any amount, any month.
import { kindOf, type Category } from "./categories";
import { addDays, addMonths, monthOf, validDate } from "./dates";
import type { Expense, Repeat } from "./types";

export type PlanKind = "income" | "loan" | "goldloan" | "invest" | "insurance" | "bill";
export interface PlanItem {
  id: string;
  name: string;
  kind: PlanKind;
  category: Category;
  /** Expected each time; null when it changes (petrol, electricity) or for a gold loan. For a loan: the EMI. */
  amountPaise: number | null;
  day: number; // 1–31
  every: 1 | 3 | 6 | 12; // months
  startMonth: string; // YYYY-MM: first month it's due
  /** Added by the app on the due day (fixed amounts like Netflix or an auto-debit SIP). */
  autoPay: boolean;
  /** Months already dealt with by auto-pay (so a deleted auto entry doesn't come back). */
  handledThrough: string | null;
  skips: string[]; // YYYY-MM
  accountId: string | null;
  loan: { principalPaise: number; ratePct: number; since: string; endBy: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

export type Status = "paid" | "skipped" | "due" | "overdue" | "notDue";

const monthsBetween = (a: string, b: string) => {
  const [ay, am] = a.split("-").map(Number) as [number, number];
  const [by, bm] = b.split("-").map(Number) as [number, number];
  return (by - ay) * 12 + (bm - am);
};
/** The date in `month` for a day, moved back to the month's last day when needed (31 → 30 Nov). */
export function dayIn(month: string, day: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  for (let d = day; d >= 28; d--) { const v = validDate(y, m, d); if (v) return v; }
  return validDate(y, m, Math.min(day, 28))!;
}
export const dueIn = (it: PlanItem, month: string) => month >= it.startMonth && monthsBetween(it.startMonth, month) % it.every === 0;
export const paymentsOf = (it: PlanItem, rows: Expense[]) => rows.filter(e => e.planId === it.id || e.repeatId === it.id);
export const paidIn = (it: PlanItem, rows: Expense[], month: string) => paymentsOf(it, rows).filter(e => monthOf(e.date) === month);
export const isMoneyIn = (it: PlanItem) => it.kind === "income";
/** Paid whenever, in any amount: a gold loan, or fuel (no fixed bill, no due date). */
export const anyTime = (it: PlanItem) => it.kind === "goldloan" || (it.amountPaise === null && it.category === "travel");

export function statusOf(it: PlanItem, rows: Expense[], month: string, now: string): Status {
  if (paidIn(it, rows, month).length) return "paid";
  if (it.skips.includes(month)) return "skipped";
  if (anyTime(it)) return month <= monthOf(now) ? "due" : "notDue"; // pay any time: never overdue
  if (!dueIn(it, month)) return "notDue";
  return dayIn(month, it.day) < now && month <= monthOf(now) ? "overdue" : "due";
}

// ---------- Loans ----------

const DAY = 86_400_000;
const days = (a: string, b: string) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / DAY));

export interface LoanState {
  /** Loan amount still owed (after interest added and payments). */
  principalPaise: number;
  /** Gold loan: interest built up and not yet paid. EMI loan: 0 (interest is added into the balance). */
  interestPaise: number;
  /** What it would take to close the loan today. */
  totalPaise: number;
  /** Rough interest for one month on what's left. */
  monthlyInterestPaise: number;
  /** EMI loan at its EMI: months left, total interest still to pay, and the month it ends. null if the EMI doesn't cover the interest. */
  projection: { months: number; interestPaise: number; endMonth: string } | null;
  paidPaise: number;
}

export function loanState(it: PlanItem, rows: Expense[], now: string): LoanState | null {
  const L = it.loan;
  if (!L) return null;
  const pays = paymentsOf(it, rows).filter(e => e.date >= L.since && e.date <= now).sort((a, b) => a.date.localeCompare(b.date));
  const paid = pays.reduce((s, e) => s + e.amountPaise, 0);
  const r = L.ratePct / 100;

  if (it.kind === "goldloan") {
    let P = L.principalPaise, I = 0, last = L.since;
    for (const p of pays) {
      I += P * r * days(last, p.date) / 365;
      const toI = Math.min(p.amountPaise, I);
      I -= toI;
      P = Math.max(0, P - (p.amountPaise - toI));
      last = p.date;
    }
    I += P * r * days(last, now) / 365;
    const principalPaise = Math.round(P), interestPaise = Math.round(I);
    return { principalPaise, interestPaise, totalPaise: principalPaise + interestPaise, monthlyInterestPaise: Math.round(P * r / 12), projection: null, paidPaise: paid };
  }

  // EMI loan: interest on the due day of each month after `since`, payments as they happen.
  const events: { date: string; pay: number }[] = pays.map(p => ({ date: p.date, pay: p.amountPaise }));
  for (let m = addMonths(monthOf(L.since), 1); m <= monthOf(now); m = addMonths(m, 1)) {
    const d = dayIn(m, it.day);
    if (d <= now) events.push({ date: d, pay: -1 }); // -1: interest
  }
  events.sort((a, b) => a.date.localeCompare(b.date) || (a.pay === -1 ? -1 : 1));
  let B = L.principalPaise;
  for (const ev of events) {
    if (ev.pay === -1) B += Math.round(B * r / 12);
    else B = Math.max(0, B - ev.pay);
  }
  const monthly = Math.round(B * r / 12);
  let projection: LoanState["projection"] = null;
  const E = it.amountPaise ?? 0;
  if (B === 0) projection = { months: 0, interestPaise: 0, endMonth: monthOf(now) };
  else if (E > monthly) {
    let b = B, n = 0, interest = 0;
    while (b > 0 && n < 600) { const i = Math.round(b * r / 12); interest += i; b = b + i - E; n++; }
    projection = { months: n, interestPaise: interest, endMonth: addMonths(monthOf(now), n) };
  }
  return { principalPaise: B, interestPaise: 0, totalPaise: B, monthlyInterestPaise: monthly, projection, paidPaise: paid };
}

/** What to suggest in the Pay box: the EMI or usual amount, else last month's payment, else (gold loan) the interest due. */
export function suggestedAmount(it: PlanItem, rows: Expense[], now: string): number | null {
  if (it.amountPaise) return it.amountPaise;
  if (it.kind === "goldloan") { const s = loanState(it, rows, now); return s && s.interestPaise > 0 ? Math.ceil(s.interestPaise / 100) * 100 : null; } // whole rupees
  const last = paymentsOf(it, rows).sort((a, b) => b.date.localeCompare(a.date))[0];
  return last?.amountPaise ?? null;
}

// ---------- A month at a glance ----------

export interface MonthTotals { toPay: number; paid: number; left: number; expectedIn: number; received: number; count: number; done: number }

export function monthTotals(items: PlanItem[], rows: Expense[], month: string, now: string): MonthTotals {
  let toPay = 0, paid = 0, expectedIn = 0, received = 0, count = 0, done = 0;
  for (const it of items) {
    const st = statusOf(it, rows, month, now);
    if (st === "notDue") continue;
    const got = paidIn(it, rows, month).reduce((s, e) => s + e.amountPaise, 0);
    const expect = st === "skipped" ? 0 : Math.max(got, suggestedAmount(it, rows, now) ?? 0);
    if (isMoneyIn(it)) { expectedIn += expect; received += got; continue; }
    count++; if (st === "paid" || st === "skipped") done++;
    toPay += expect; paid += got;
  }
  return { toPay, paid, left: Math.max(toPay - paid, 0), expectedIn, received, count, done };
}

// ---------- Auto-pay ----------

export const autoEntryId = (itemId: string, month: string) => `p-${itemId}-${month}`;

/** Entries auto-pay items should have added by today, and the items moved forward. Running it twice adds nothing twice. */
export function duePayments(items: PlanItem[], rows: Expense[], now: string, at: string): { entries: Expense[]; items: PlanItem[] } {
  const entries: Expense[] = [], moved: PlanItem[] = [];
  for (const it of items) {
    if (!it.autoPay || !it.amountPaise || it.kind === "goldloan") continue;
    let handled = it.handledThrough;
    for (let m = it.startMonth, n = 0; m <= monthOf(now) && n < 36; m = addMonths(m, 1), n++) {
      if (handled && m <= handled) continue;
      if (!dueIn(it, m)) continue;
      const date = dayIn(m, it.day);
      if (date > now) break;
      if (!it.skips.includes(m) && !paidIn(it, rows, m).length) {
        const e: Expense = { id: autoEntryId(it.id, m), amountPaise: it.amountPaise, note: it.name, category: it.category, method: null, date, createdAt: at, updatedAt: at, planId: it.id };
        if (it.accountId) e.accountId = it.accountId;
        entries.push(e);
      }
      handled = m;
    }
    if (handled !== it.handledThrough) moved.push({ ...it, handledThrough: handled });
  }
  return { entries, items: moved };
}

/** Next due date on or after today (not already paid or skipped), for the Home card. */
export function nextDue(it: PlanItem, rows: Expense[], now: string): string | null {
  if (it.kind === "goldloan") return null;
  for (let m = monthOf(now), n = 0; n < 13; m = addMonths(m, 1), n++) {
    if (!dueIn(it, m) || it.skips.includes(m) || paidIn(it, rows, m).length) continue;
    const d = dayIn(m, it.day);
    if (d >= now) return d;
  }
  return null;
}
export const dueSoon = (items: PlanItem[], rows: Expense[], now: string, within = 7) =>
  items.map(it => ({ it, date: nextDue(it, rows, now) })).filter((x): x is { it: PlanItem; date: string } => !!x.date && x.date <= addDays(now, within) && !isMoneyIn(x.it))
    .sort((a, b) => a.date.localeCompare(b.date));

// ---------- From the old "Every month" repeats ----------

/** A repeat rule becomes an auto-pay item with the same id, so its past entries (repeatId) stay linked. */
export function fromRepeat(r: Repeat, at: string): PlanItem {
  const kind: PlanKind = kindOf(r.category) === "in" ? "income" : kindOf(r.category) === "invest" ? (/Ins$/.test(r.category) ? "insurance" : "invest") : r.category === "rent" ? "loan" : "bill";
  return {
    id: r.id, name: r.note || r.category, kind: kind === "loan" ? "bill" : kind, category: r.category, amountPaise: r.amountPaise, day: r.day, every: 1,
    startMonth: r.lastMonth, autoPay: true, handledThrough: r.lastMonth, skips: [], accountId: null, loan: null, createdAt: r.createdAt || at, updatedAt: at,
  };
}

/** Templates for the Add form: what each kind of item is called and which category its payments go to. */
export const PRESETS: { key: string; kind: PlanKind; category: Category; name: string; autoPay: boolean; every: 1 | 3 | 6 | 12; varies?: boolean }[] = [
  { key: "salary", kind: "income", category: "salary", name: "Salary", autoPay: false, every: 1 },
  { key: "loan", kind: "loan", category: "rent", name: "Personal loan", autoPay: false, every: 1 },
  { key: "goldloan", kind: "goldloan", category: "rent", name: "Gold loan", autoPay: false, every: 1 },
  { key: "sip", kind: "invest", category: "sip", name: "SIP", autoPay: false, every: 1 },
  { key: "term", kind: "insurance", category: "termIns", name: "Term insurance", autoPay: false, every: 12 },
  { key: "lic", kind: "insurance", category: "otherIns", name: "LIC", autoPay: false, every: 12 },
  { key: "health", kind: "insurance", category: "healthIns", name: "Health insurance", autoPay: false, every: 12 },
  { key: "electricity", kind: "bill", category: "bills", name: "Electricity", autoPay: false, every: 1, varies: true },
  { key: "mobile", kind: "bill", category: "bills", name: "Mobile recharge", autoPay: false, every: 1 },
  { key: "family", kind: "bill", category: "bills", name: "Family mobile", autoPay: false, every: 1 },
  { key: "wifi", kind: "bill", category: "bills", name: "Wi-Fi", autoPay: false, every: 1 },
  { key: "netflix", kind: "bill", category: "bills", name: "Netflix", autoPay: true, every: 1 },
  { key: "chatgpt", kind: "bill", category: "bills", name: "ChatGPT", autoPay: true, every: 1 },
  { key: "bike", kind: "bill", category: "travel", name: "Bike petrol", autoPay: false, every: 1, varies: true },
  { key: "car", kind: "bill", category: "travel", name: "Car petrol", autoPay: false, every: 1, varies: true },
  { key: "other", kind: "bill", category: "other", name: "", autoPay: false, every: 1 },
];

// ---------- Smart help (all worked out on the phone) ----------

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9ऀ-෿ ]/g, " ").split(/\s+/).filter(w => w.length >= 3);
const KEY_ALIASES: Record<string, string[]> = {
  electricity: ["bescom", "electricity", "current", "power", "light", "mescom", "hescom", "cesc", "gescom"],
  "mobile recharge": ["recharge", "mobile", "jio", "airtel", "bsnl"],
  "wi-fi": ["wifi", "broadband", "internet", "fiber", "fibre", "act", "hathway"],
  "bike petrol": ["bike", "petrol"], "car petrol": ["car", "petrol", "diesel"],
  sip: ["sip", "groww", "zerodha", "kuvera", "mutual"], lic: ["lic"], salary: ["salary"],
};
function itemWords(it: PlanItem): string[] {
  const n = it.name.toLowerCase();
  return [...new Set([...words(n), ...(KEY_ALIASES[n] ?? [])])];
}

/**
 * The monthly item a new entry most likely pays: same kind of money (in/out), a shared word in the name
 * ("netflix 649" → Netflix; "bescom 1840" → Electricity), and not already paid this month unless its amount varies.
 * When two items fit (bike petrol / car petrol), the one whose own name word appears wins; still a tie → none.
 */
export function matchItem(e: Pick<Expense, "note" | "category" | "date" | "amountPaise">, items: PlanItem[], rows: Expense[]): PlanItem | null {
  const ew = new Set(words(e.note));
  if (!ew.size) return null;
  const inMoney = kindOf(e.category) === "in";
  const month = monthOf(e.date);
  const fits = items.filter(it => {
    if (isMoneyIn(it) !== inMoney) return false;
    if (it.amountPaise !== null && paidIn(it, rows, month).length) return false; // fixed amount already paid this month
    return itemWords(it).some(w => ew.has(w));
  });
  if (fits.length <= 1) return fits[0] ?? null;
  const strong = fits.filter(it => words(it.name).some(w => ew.has(w) && !["petrol", "mobile", "insurance", "loan"].includes(w)));
  return strong.length === 1 ? strong[0]! : null;
}

/** Spends that look monthly but aren't in Payments yet: the same name in 2 of the last 3 months, amounts within 25%. */
export function looksMonthly(rows: Expense[], items: PlanItem[], now: string): { name: string; category: Category; amountPaise: number; months: string[]; day: number }[] {
  const cur = monthOf(now);
  const last3 = [addMonths(cur, -3), addMonths(cur, -2), addMonths(cur, -1)];
  const known = new Set(items.flatMap(itemWords));
  const by = new Map<string, Expense[]>();
  for (const e of rows) {
    if (e.planId || e.repeatId || !last3.includes(monthOf(e.date)) || kindOf(e.category) === "in") continue;
    const key = words(e.note)[0];
    if (!key || known.has(key)) continue;
    by.set(key, [...(by.get(key) ?? []), e]);
  }
  const out: { name: string; category: Category; amountPaise: number; months: string[]; day: number }[] = [];
  for (const es of by.values()) {
    const months = [...new Set(es.map(e => monthOf(e.date)))].sort();
    if (months.length < 2) continue;
    const perMonth = months.map(m => es.filter(e => monthOf(e.date) === m).reduce((s, e) => s + e.amountPaise, 0));
    const lo = Math.min(...perMonth), hi = Math.max(...perMonth);
    if (hi > lo * 1.25) continue;
    const latest = es.sort((a, b) => b.date.localeCompare(a.date))[0]!;
    const name = latest.note.trim().split(/\s+/).slice(0, 3).join(" ");
    out.push({ name: name.charAt(0).toUpperCase() + name.slice(1), category: latest.category, amountPaise: perMonth[perMonth.length - 1]!, months, day: Number(latest.date.slice(8)) });
  }
  return out.sort((a, b) => b.amountPaise - a.amountPaise).slice(0, 3);
}

/** EMI loan: what paying a bit more each month does. The extra is about 10% of the EMI, rounded to ₹500 (at least ₹500). */
export function payMoreTip(it: PlanItem, rows: Expense[], now: string): { extraPaise: number; monthsSooner: number; interestSaved: number } | null {
  const s = loanState(it, rows, now);
  if (!s?.projection || s.projection.months < 3 || !it.amountPaise || !it.loan) return null;
  const extra = Math.max(500_00, Math.round(it.amountPaise * 0.1 / 500_00) * 500_00);
  const r = it.loan.ratePct / 100;
  let b = s.principalPaise, n = 0, interest = 0;
  while (b > 0 && n < 600) { const i = Math.round(b * r / 12); interest += i; b = b + i - (it.amountPaise + extra); n++; }
  const sooner = s.projection.months - n, saved = s.projection.interestPaise - interest;
  return sooner > 0 && saved > 0 ? { extraPaise: extra, monthsSooner: sooner, interestSaved: saved } : null;
}
