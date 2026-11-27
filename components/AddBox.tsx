"use client";

// The add box, docked at the bottom of Home within thumb reach: "chai 20", "salary 50000", "lent ravi 500".
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { CATEGORIES, guessCategory, isIncomeCategory, type Category } from "@/lib/categories";
import { parseDebt, type Direction } from "@/lib/debts";
import { useI18n } from "@/lib/i18n";
import { rupees } from "@/lib/money";
import { parseEntry, type Method, type Parsed } from "@/lib/parse";
import { kindOf } from "@/lib/categories";
import { shares, splitWords } from "@/lib/split";
import type { Settings } from "@/lib/types";
import { payLink, payeeNote, type UpiPayee } from "@/lib/upi";
import type { Account } from "@/lib/wealth";
import { ScanSheet, canScan } from "./ScanSheet";

export interface DebtInput { person: string; dir: Direction; amountPaise: number; date: string }
export interface SplitInput { people: string[]; ways: number; eachPaise: number; totalPaise: number }
export interface AddBoxHandle { fill: (text: string) => void; focus: () => void; scan: () => void }

export const AddBox = forwardRef<AddBoxHandle, {
  now: string;
  learned: ReadonlyMap<string, Category>;
  typing: boolean;
  accounts: Account[];
  settings: Settings;
  /** paidTo: the shop paid by Scan & pay, so coming back from the UPI app can offer an undo. */
  onAdd: (p: Parsed, pickedCategory: boolean, everyMonth: boolean, accountId?: string | null, split?: SplitInput, paidTo?: string) => Promise<void>;
  onDebt: (d: DebtInput) => Promise<void>;
}>(function AddBox({ now, learned, typing, accounts, settings, onAdd, onDebt }, ref) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [cat, setCat] = useState<Category | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [method, setMethod] = useState<Method | null | undefined>(undefined);
  const [monthly, setMonthly] = useState(false);
  const [account, setAccount] = useState<string | null | undefined>(undefined); // undefined: the default for UPI / cash
  const [tried, setTried] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  // Scan & pay: the shop from the QR. While set, the box takes the amount and Save becomes Pay.
  const [payTo, setPayTo] = useState<UpiPayee | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanner, setScanner] = useState(false);
  useEffect(() => { void canScan().then(setScanner); }, []);
  function found(p: UpiPayee) {
    setScanOpen(false); setPayTo(p); setMethod("upi"); setCat(null); setTried(false);
    const s = p.amountPaise ? (p.amountPaise % 100 ? (p.amountPaise / 100).toFixed(2) : String(p.amountPaise / 100)) : "";
    setText(s);
    setTimeout(() => { input.current?.focus(); input.current?.setSelectionRange(s.length, s.length); }, 50);
  }

  useImperativeHandle(ref, () => ({
    fill: (s: string) => { setText(s); setTried(false); setTimeout(() => { input.current?.focus(); input.current?.setSelectionRange(s.length, s.length); }, 50); },
    focus: () => input.current?.focus(),
    scan: () => setScanOpen(true),
  }), []);

  const sw = useMemo(() => splitWords(text), [text]);
  const debt = useMemo(() => (sw ? null : parseDebt(text, now)), [sw, text, now]);
  const parsed = useMemo(() => parseEntry(sw ? sw.rest : text, now, learned), [sw, text, now, learned]);
  // Paying a shop: just an amount is enough; the shop's name is the note and picks the category.
  const payNote = payTo && parsed.ok && !parsed.value.note ? payeeNote(payTo) : null;
  const guessed = parsed.ok ? (payNote ? guessCategory(payNote, learned) : parsed.value.category) : null;
  const value: Parsed | null = !debt && parsed.ok
    ? { ...parsed.value, note: payNote ?? parsed.value.note, category: cat ?? guessed!, date: date ?? parsed.value.date, method: method !== undefined ? method : parsed.value.method }
    : null;
  const income = value ? isIncomeCategory(value.category) : false;
  // A bill split only applies to a spend (not money in or an investment).
  const split = sw && value && kindOf(value.category) === "spend" ? { ...sw, ...shares(value.amountPaise, sw.ways) } : null;
  const names = (ps: string[]) => (ps.length > 1 ? `${ps.slice(0, -1).join(", ")} ${t.split.and} ${ps[ps.length - 1]}` : ps[0] ?? "");

  // The box clears the moment a line is saved, before the save finishes, so the next line can be typed straight away
  // without losing letters or being glued to the last one. Saves run one after another; a failed save puts its line back
  // (unless something new has been typed meanwhile).
  const queue = useRef<Promise<void>>(Promise.resolve());
  const textNow = useRef(text);
  useEffect(() => { textNow.current = text; }, [text]);
  function submit(job: () => Promise<void>) {
    const back = { text, cat, date, method, monthly, account };
    reset();
    queue.current = queue.current.then(job).catch(err => {
      console.error("save failed", err);
      if (textNow.current) return;
      setText(back.text); setCat(back.cat); setDate(back.date); setMethod(back.method); setMonthly(back.monthly); setAccount(back.account); setTried(true);
    });
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (debt) {
      if (!debt.ok) { setTried(true); input.current?.focus(); return; }
      const d = { ...debt.value, date: date ?? debt.value.date };
      submit(() => onDebt(d));
      return;
    }
    if (!value) { setTried(true); input.current?.focus(); return; }
    const picked = cat !== null && parsed.ok && cat !== guessed;
    const sp = split ? { people: split.people, ways: split.ways, eachPaise: split.each, totalPaise: value.amountPaise } : undefined;
    const entry = sp ? { ...value, amountPaise: split!.yours } : value;
    const repeat = monthly && !sp, acc = account;
    if (payTo) {
      // Save first, then hand over to the UPI app with the full amount filled in.
      const link = payLink(payTo, value.amountPaise), to = payTo.name ? payeeNote(payTo) : payTo.pa;
      submit(() => onAdd({ ...entry, method: "upi" }, picked, false, acc, sp, to));
      location.href = link;
      return;
    }
    submit(() => onAdd(entry, picked, repeat, acc, sp));
  }
  function reset() { setPayTo(null); setText(""); setCat(null); setDate(null); setMethod(undefined); setMonthly(false); setAccount(undefined); setTried(false); input.current?.focus(); }
  const shownAccount = value ? (account !== undefined ? account : value.method === "upi" ? settings.upiAccount : value.method === "cash" ? settings.cashAccount : null) : null;

  const error = tried
    ? debt && !debt.ok ? t.err[debt.code] : !parsed.ok ? t.err[text.trim() ? parsed.code : "empty"] : null
    : null;
  const pill = "press min-h-9 rounded-full border border-line px-3 text-[14px] font-medium aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-fg";
  const dateChip = (v: string) => (
    <label className="chip">
      <span className="sr-only">{t.add.date}</span>
      <input type="date" value={v} max={now} onChange={e => { if (e.target.value && e.target.value <= now) setDate(e.target.value); }} className="chip-select num" />
    </label>
  );

  return (
    <form onSubmit={save} noValidate data-typing={typing} className="dock fixed inset-x-0 z-30">
      <div className="mx-auto max-w-xl rounded-t-2xl border border-b-0 border-line bg-card px-3 pt-2.5 pb-3 shadow-[0_-6px_24px_rgb(0_0_0/0.08)]">
        {payTo && (
          <div className="mb-1.5 flex items-center gap-2 px-1" data-testid="paying">
            <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-accent">{t.scan.paying(payTo.name ? payeeNote(payTo) : payTo.pa)}</span>
            <button type="button" onClick={() => { setPayTo(null); setText(""); setMethod(undefined); input.current?.focus(); }} className="press min-h-9 rounded-full border border-line px-3 text-[14px] font-medium" data-testid="paying-cancel">{t.scan.cancel}</button>
          </div>
        )}
        <div id="entry-help" className="mb-2 px-1" aria-live="polite">
          {debt?.ok ? (
            <div className="flex flex-wrap items-center gap-1.5" data-testid="debt-preview">
              <span className="num me-1 text-xl font-bold">{rupees(debt.value.amountPaise)}</span>
              <span className="font-medium">{debt.value.dir === "gave" ? t.add.gave(debt.value.person) : t.add.got(debt.value.person)}</span>
              {dateChip(date ?? debt.value.date)}
              <span className="w-full text-[13px] text-muted">{t.add.toPeople}</span>
            </div>
          ) : value ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`num me-1 text-xl font-bold ${income ? "text-accent" : ""}`} data-testid="preview-amount">{income ? "+" : ""}{rupees(value.amountPaise)}</span>
              <label className="chip">
                <span className="sr-only">{t.add.category}</span>
                <select value={value.category} onChange={e => setCat(e.target.value as Category)} className="chip-select">
                  {(["spend", "in", "invest"] as const).map(k => (
                    <optgroup key={k} label={k === "spend" ? t.add.spent : k === "in" ? t.add.in : t.add.invest}>
                      {CATEGORIES.filter(c => c.kind === k).map(c => <option key={c.key} value={c.key}>{t.cat[c.key]}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
              {dateChip(value.date)}
              {(["cash", "upi"] as const).map(m => (
                <button key={m} type="button" aria-pressed={value.method === m} onClick={() => setMethod(value.method === m ? null : m)} className={pill}>
                  {m === "upi" ? t.upi : t.cash}
                </button>
              ))}
              {!split && !payTo && <button type="button" aria-pressed={monthly} onClick={() => setMonthly(v => !v)} className={pill}>{t.everyMonth}</button>}
              {accounts.length > 0 && (
                <label className="chip">
                  <span className="sr-only">{t.wealth.account}</span>
                  <select value={shownAccount ?? ""} onChange={e => setAccount(e.target.value || null)} className="chip-select" data-testid="entry-account">
                    <option value="">{t.wealth.noAccount}</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </label>
              )}
              {split && (
                <span className="num w-full text-[13px] text-muted" data-testid="split-preview">
                  {t.split.ways(split.ways, split.yours)} · {split.people.length ? t.split.owe(names(split.people), split.people.length === 1, split.each) : t.split.others}
                </span>
              )}
            </div>
          ) : error ? (
            <p className="text-[14px] font-medium text-bad" role="alert">{error}</p>
          ) : payTo ? (
            <p className="text-[13px] leading-snug text-muted">{t.scan.hint}</p>
          ) : typing && !text ? (
            <p className="text-[13px] leading-snug text-muted">{t.add.hint}</p>
          ) : (
            <label htmlFor="entry" className="text-[14px] font-semibold">{t.add.label}</label>
          )}
        </div>
        <div className="flex gap-2">
          {debt || value || error || payTo || (typing && !text) ? <label htmlFor="entry" className="sr-only">{t.add.label}</label> : null}
          {scanner && !payTo && (
            <button type="button" onClick={() => setScanOpen(true)} aria-label={t.scan.open} title={t.scan.open} data-testid="scan-open"
              className="press grid min-h-12 w-12 shrink-0 place-items-center rounded-xl border border-line bg-soft text-fg">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><rect x="8" y="8" width="8" height="8" rx="1" />
              </svg>
            </button>
          )}
          <input ref={input} id="entry" value={text} onChange={e => { setText(e.target.value); setTried(false); }}
            placeholder={payTo ? "₹" : t.add.placeholder} autoComplete="off" spellCheck={false} enterKeyHint="done"
            aria-invalid={error ? true : undefined} aria-describedby="entry-help"
            className="field min-w-0 flex-1 text-[17px]" />
          <button type="submit" className="press min-h-12 shrink-0 rounded-xl bg-accent px-5 text-[16px] font-semibold text-accent-fg">
            {payTo ? (value ? t.scan.payAmt(rupees(value.amountPaise)) : t.scan.pay) : t.save}
          </button>
        </div>
      </div>
      <ScanSheet open={scanOpen} onClose={() => { setScanOpen(false); input.current?.focus(); }} onFound={found} />
    </form>
  );
});
