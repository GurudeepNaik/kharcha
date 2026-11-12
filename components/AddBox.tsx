"use client";

// The add box, docked at the bottom of Home within thumb reach: "chai 20", "salary 50000", "lent ravi 500".
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { CATEGORIES, isIncomeCategory, type Category } from "@/lib/categories";
import { parseDebt, type Direction } from "@/lib/debts";
import { useI18n } from "@/lib/i18n";
import { rupees } from "@/lib/money";
import { parseEntry, type Method, type Parsed } from "@/lib/parse";

export interface DebtInput { person: string; dir: Direction; amountPaise: number; date: string }
export interface AddBoxHandle { fill: (text: string) => void; focus: () => void }

export const AddBox = forwardRef<AddBoxHandle, {
  now: string;
  learned: ReadonlyMap<string, Category>;
  typing: boolean;
  onAdd: (p: Parsed, pickedCategory: boolean, everyMonth: boolean) => Promise<void>;
  onDebt: (d: DebtInput) => Promise<void>;
}>(function AddBox({ now, learned, typing, onAdd, onDebt }, ref) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [cat, setCat] = useState<Category | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [method, setMethod] = useState<Method | null | undefined>(undefined);
  const [monthly, setMonthly] = useState(false);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    fill: (s: string) => { setText(s); setTried(false); setTimeout(() => { input.current?.focus(); input.current?.setSelectionRange(s.length, s.length); }, 50); },
    focus: () => input.current?.focus(),
  }), []);

  const debt = useMemo(() => parseDebt(text, now), [text, now]);
  const parsed = useMemo(() => parseEntry(text, now, learned), [text, now, learned]);
  const value: Parsed | null = !debt && parsed.ok
    ? { ...parsed.value, category: cat ?? parsed.value.category, date: date ?? parsed.value.date, method: method !== undefined ? method : parsed.value.method }
    : null;
  const income = value ? isIncomeCategory(value.category) : false;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (debt) {
      if (!debt.ok) { setTried(true); input.current?.focus(); return; }
      setSaving(true);
      try { await onDebt({ ...debt.value, date: date ?? debt.value.date }); reset(); } finally { setSaving(false); }
      return;
    }
    if (!value) { setTried(true); input.current?.focus(); return; }
    setSaving(true);
    try { await onAdd(value, cat !== null && parsed.ok && cat !== parsed.value.category, monthly); reset(); } finally { setSaving(false); }
  }
  function reset() { setText(""); setCat(null); setDate(null); setMethod(undefined); setMonthly(false); setTried(false); input.current?.focus(); }

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
                  <optgroup label={t.add.spent}>{CATEGORIES.filter(c => !c.income).map(c => <option key={c.key} value={c.key}>{t.cat[c.key]}</option>)}</optgroup>
                  <optgroup label={t.add.in}>{CATEGORIES.filter(c => c.income).map(c => <option key={c.key} value={c.key}>{t.cat[c.key]}</option>)}</optgroup>
                </select>
              </label>
              {dateChip(value.date)}
              {(["cash", "upi"] as const).map(m => (
                <button key={m} type="button" aria-pressed={value.method === m} onClick={() => setMethod(value.method === m ? null : m)} className={pill}>
                  {m === "upi" ? t.upi : t.cash}
                </button>
              ))}
              <button type="button" aria-pressed={monthly} onClick={() => setMonthly(v => !v)} className={pill}>{t.everyMonth}</button>
            </div>
          ) : error ? (
            <p className="text-[14px] font-medium text-bad" role="alert">{error}</p>
          ) : typing && !text ? (
            <p className="text-[13px] leading-snug text-muted">{t.add.hint}</p>
          ) : (
            <label htmlFor="entry" className="text-[14px] font-semibold">{t.add.label}</label>
          )}
        </div>
        <div className="flex gap-2">
          {debt || value || error || (typing && !text) ? <label htmlFor="entry" className="sr-only">{t.add.label}</label> : null}
          <input ref={input} id="entry" value={text} onChange={e => { setText(e.target.value); setTried(false); }}
            placeholder={t.add.placeholder} autoComplete="off" spellCheck={false} enterKeyHint="done"
            aria-invalid={error ? true : undefined} aria-describedby="entry-help"
            className="field min-w-0 flex-1 text-[17px]" />
          <button type="submit" disabled={saving} className="press min-h-12 shrink-0 rounded-xl bg-accent px-5 text-[16px] font-semibold text-accent-fg disabled:opacity-60">
            {t.save}
          </button>
        </div>
      </div>
    </form>
  );
});
