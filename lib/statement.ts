// Bank statement import: a CSV/TSV/TXT export from the bank's website or app, read on the phone.
// Banks name their columns differently (Date / Txn Date, Narration / Description / Particulars,
// Withdrawal / Debit, Deposit / Credit, or one Amount with Dr/Cr), so columns are found by their headers.
import { guessCategory, isIncomeCategory, type Category } from "./categories";
import { addDays, validDate } from "./dates";
import { MAX_PAISE } from "./money";
import type { Method } from "./parse";
import type { Expense } from "./types";

export interface StatementRow { date: string; amountPaise: number; dir: "out" | "in"; narration: string; note: string; method: Method | null }
export type StatementResult =
  | { ok: true; rows: StatementRow[]; skipped: number }
  | { ok: false; code: "noHeader" | "noRows" | "tooBig" };

/** Splits delimited text into rows of cells, handling "quoted, cells" and "" escapes. The delimiter is guessed. */
export function parseDelimited(text: string): string[][] {
  const sample = text.slice(0, 4000);
  const delim = [",", "\t", ";", "|"].map(d => [d, sample.split(d).length] as const).sort((a, b) => b[1] - a[1])[0]![0];
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell.trim()); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim()); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
  return rows.filter(r => r.some(c => c));
}

const MON = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
/** Indian bank dates: 12/11/2026, 12-11-26, 12.11.2026, 2026-11-12, 12-Nov-2026, 12 Nov 26. Day comes first. */
export function readDate(s: string): string | null {
  const t = s.trim().toLowerCase().replace(/\s+\d{1,2}:\d{2}(:\d{2})?(\s*[ap]m)?$/, "");
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  if (m) return validDate(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(t);
  if (m) return validDate(m[3]!.length === 2 ? 2000 + Number(m[3]) : Number(m[3]), Number(m[2]), Number(m[1]));
  m = /^(\d{1,2})[\s/.-]([a-z]{3})[a-z]*[\s/.,-]+(\d{2}|\d{4})$/.exec(t);
  if (m && MON.includes(m[2]!)) return validDate(m[3]!.length === 2 ? 2000 + Number(m[3]) : Number(m[3]), MON.indexOf(m[2]!) + 1, Number(m[1]));
  return null;
}

/** "1,234.50", "₹ 1,234.50 Dr", "-500" → paise and a direction when the cell says so. */
export function readAmount(s: string): { paise: number; dir: "out" | "in" | null } | null {
  const t = s.replace(/[₹,\s]|inr|rs\.?/gi, "");
  const m = /^(-)?(\d+(?:\.\d{1,2})?)(dr|cr)?$/i.exec(t);
  if (!m) return null;
  const paise = Math.round(Number(m[2]) * 100);
  if (!(paise > 0) || paise > MAX_PAISE) return null;
  const dir = m[3] ? (m[3].toLowerCase() === "dr" ? "out" : "in") : m[1] ? "out" : null;
  return { paise, dir };
}

const NOISE = new Set(["upi", "dr", "cr", "imps", "neft", "rtgs", "pos", "to", "transfer", "by", "payment", "p2a", "p2m", "mmt", "ach", "nach", "ecs", "inb", "bil", "onl", "ref", "txn", "ib", "mob", "mb", "from", "fund", "trf", "debit", "credit", "card", "paid", "via", "pay", "sent", "collect", "request", "received", "receive", "upiint", "upiout", "yesb", "utib", "icic", "hdfc", "sbin", "kkbk", "pytm", "ybl", "okaxis", "oksbi", "okhdfcbank", "okicici", "ibl", "axl", "na", "null"]);

/** The readable part of a bank narration: "UPI-RAVI KUMAR-ravi@okaxis-UTIB0000-4321-PAY" → "Ravi Kumar". */
export function noteFromNarration(n: string): string {
  const low = n.toLowerCase();
  if (/\b(atm|nwd|cash withdrawal|cwdr|atw)\b/.test(low)) return "ATM cash";
  if (/\bsalary\b|\bsal\b/.test(low)) return "salary";
  if (/\binterest\b|\bint\.? ?(pd|paid|cr)\b/.test(low)) return "interest";
  const parts = n.split(/[-/:|*]+|\s{2,}/).map(p => p.trim()).filter(Boolean);
  for (const p of parts) {
    if (p.includes("@") || /^[A-Z]{4}0[A-Z0-9]{6}$/i.test(p)) continue; // UPI IDs and bank branch codes
    const words = p.split(/\s+/).filter(w => /[a-z]/i.test(w) && !NOISE.has(w.toLowerCase()) && !/\d{3,}/.test(w));
    if (words.join("").length >= 3) return words.slice(0, 3).map(w => w[0]!.toUpperCase() + w.slice(1).toLowerCase()).join(" ").slice(0, 30);
  }
  return n.replace(/\s+/g, " ").trim().slice(0, 30);
}

const pick = (h: string[], re: RegExp, not?: RegExp) => h.findIndex(x => re.test(x) && !(not && not.test(x)));

export function readStatement(text: string): StatementResult {
  if (text.length > 10_000_000) return { ok: false, code: "tooBig" };
  const grid = parseDelimited(text);
  // The header row: the first row (of the first 60) naming a date column and an amount-like column.
  let hi = -1;
  for (let i = 0; i < Math.min(grid.length, 60); i++) {
    const h = grid[i]!.map(c => c.toLowerCase());
    if (h.some(c => /date/.test(c)) && h.some(c => /withdrawal|debit|deposit|credit|amount/.test(c))) { hi = i; break; }
  }
  if (hi < 0) return { ok: false, code: "noHeader" };
  const h = grid[hi]!.map(c => c.toLowerCase().replace(/\s+/g, " ").trim());
  let date = pick(h, /^(txn|transaction|tran|trans|posting|post)\.? ?date/);
  if (date < 0) date = pick(h, /date/, /value/);
  if (date < 0) date = pick(h, /date/);
  const note = pick(h, /narration|description|particulars|remarks|details|transaction remarks/);
  const debit = pick(h, /withdrawal|debit|\bdr\b|paid out/, /credit|\/|type/);
  const credit = pick(h, /deposit|credit|\bcr\b|paid in/, /debit|\/|type/);
  const amount = pick(h, /^(transaction )?amount|^amt/);
  const type = pick(h, /dr ?\/ ?cr|cr ?\/ ?dr|^type$|debit ?\/ ?credit|^dr\/cr/);

  const rows: StatementRow[] = [];
  let skipped = 0;
  for (const r of grid.slice(hi + 1)) {
    const d = readDate(r[date] ?? "");
    if (!d) { if (r.some(c => /\d/.test(c))) skipped++; continue; }
    let paise = 0, dir: "out" | "in" | null = null;
    const dv = debit >= 0 ? readAmount(r[debit] ?? "") : null;
    const cv = credit >= 0 ? readAmount(r[credit] ?? "") : null;
    if (dv && !cv) { paise = dv.paise; dir = "out"; }
    else if (cv && !dv) { paise = cv.paise; dir = "in"; }
    else if (amount >= 0) {
      const av = readAmount(r[amount] ?? "");
      if (av) {
        paise = av.paise;
        const tv = type >= 0 ? (r[type] ?? "").toLowerCase() : "";
        dir = /^(dr|d|debit|withdrawal)/.test(tv) ? "out" : /^(cr|c|credit|deposit)/.test(tv) ? "in" : av.dir;
        // One signed Amount column and nothing saying Dr/Cr: minus is money out, plus is money in.
        if (!dir && type < 0 && debit < 0 && credit < 0) dir = "in";
      }
    }
    if (!paise || !dir) { skipped++; continue; }
    const narration = (note >= 0 ? r[note] : "")?.replace(/\s+/g, " ").trim() ?? "";
    rows.push({ date: d, amountPaise: paise, dir, narration, note: noteFromNarration(narration), method: /\bupi\b/i.test(narration) ? "upi" : /\b(atm|nwd)\b/i.test(narration) ? "cash" : null });
  }
  if (!rows.length) return { ok: false, code: "noRows" };
  return { ok: true, rows, skipped };
}

export type Skip = "duplicate" | "atm" | "card" | null;
/** Paying a credit-card bill moves money between your own accounts; the card spends were (or will be) noted one by one. */
const CARD_BILL = /credit ?card|card ?bill|cc ?(pay|bill)|\b(hdfc|icici|sbi|axis|kotak|amex|rbl|indus|yes|idfc|au|hsbc|sc)cc\b|cred club|billdesk.*card/i;
export interface ImportItem { row: StatementRow; category: Category; include: boolean; reason: Skip }

/**
 * What each statement row becomes, and whether it's ticked. Left unticked: rows that look already noted
 * (same amount, same direction, within a day), ATM withdrawals (cash, not spending) and credit-card bill payments.
 */
export function planImport(rows: StatementRow[], existing: Expense[], learned: ReadonlyMap<string, Category>): ImportItem[] {
  const used = new Set<string>();
  return rows.map(row => {
    let category = guessCategory(`${row.note} ${row.narration}`, learned);
    if (row.dir === "in" && !isIncomeCategory(category)) category = row.note === "salary" ? "salary" : row.note === "interest" ? "returns" : "income";
    if (row.dir === "out" && isIncomeCategory(category)) category = "other";
    let reason: Skip = null;
    const dup = existing.find(e => !used.has(e.id) && e.amountPaise === row.amountPaise && isIncomeCategory(e.category) === (row.dir === "in") &&
      e.date >= addDays(row.date, -1) && e.date <= addDays(row.date, 1));
    if (dup) { used.add(dup.id); reason = "duplicate"; }
    else if (row.note === "ATM cash") reason = "atm";
    else if (row.dir === "out" && CARD_BILL.test(row.narration)) reason = "card";
    return { row, category, include: reason === null, reason };
  });
}
