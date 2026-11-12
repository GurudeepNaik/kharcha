"use client";

// The one box at the top of Home: type "chai 20", check the preview, Save.
import { useMemo, useRef, useState } from "react";
import { CATEGORIES, type Category } from "@/lib/categories";
import { rupees } from "@/lib/money";
import { parseEntry, type Method, type Parsed } from "@/lib/parse";

export function AddBox({ now, learned, onAdd }: {
  now: string;
  learned: ReadonlyMap<string, Category>;
  onAdd: (p: Parsed, pickedCategory: boolean) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [cat, setCat] = useState<Category | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [method, setMethod] = useState<Method | null | undefined>(undefined);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parseEntry(text, now, learned), [text, now, learned]);
  const value: Parsed | null = parsed.ok
    ? {
        ...parsed.value,
        category: cat ?? parsed.value.category,
        date: date ?? parsed.value.date,
        // Paid by: what was tapped here, else what the line says ("upi", "cash"), else not set.
        method: method !== undefined ? method : parsed.value.method,
      }
    : null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!value) { setTried(true); input.current?.focus(); return; }
    setSaving(true);
    try {
      await onAdd(value, cat !== null && parsed.ok && cat !== parsed.value.category);
      setText(""); setCat(null); setDate(null); setMethod(undefined); setTried(false);
      input.current?.focus();
    } finally { setSaving(false); }
  }

  const error = !parsed.ok && tried && text.trim() !== "" ? parsed.error : !parsed.ok && tried ? "Type what you spent, like chai 20." : null;

  return (
    <form onSubmit={save} className="rounded-2xl border border-line bg-card p-3 shadow-sm" noValidate>
      <label htmlFor="entry" className="mb-1.5 block px-1 text-[15px] font-semibold">What did you spend?</label>
      <div className="flex gap-2">
        <input ref={input} id="entry" value={text} onChange={e => { setText(e.target.value); setTried(false); }}
          placeholder="e.g. chai 20" autoComplete="off" spellCheck={false} enterKeyHint="done"
          aria-invalid={error ? true : undefined} aria-describedby="entry-help"
          className="field min-w-0 flex-1 text-[17px]" />
        <button type="submit" disabled={saving}
          className="press min-h-12 shrink-0 rounded-xl bg-accent px-5 text-[16px] font-semibold text-accent-fg disabled:opacity-60">
          Save
        </button>
      </div>

      <div id="entry-help" className="mt-2 min-h-11" aria-live="polite">
        {value ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="num me-1 text-xl font-bold" data-testid="preview-amount">{rupees(value.amountPaise)}</span>
            <label className="chip">
              <span className="sr-only">Category</span>
              <select value={value.category} onChange={e => setCat(e.target.value as Category)} className="chip-select">
                {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </label>
            <label className="chip">
              <span className="sr-only">Date</span>
              <input type="date" value={value.date} max={now} onChange={e => { if (e.target.value && e.target.value <= now) setDate(e.target.value); }}
                className="chip-select num" />
            </label>
            <div role="group" aria-label="Paid by" className="flex gap-1">
              {(["cash", "upi"] as const).map(m => (
                <button key={m} type="button" aria-pressed={value.method === m}
                  onClick={() => setMethod(value.method === m ? null : m)}
                  className="press min-h-9 rounded-full border border-line px-3 text-[14px] font-medium aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-fg">
                  {m === "upi" ? "UPI" : "Cash"}
                </button>
              ))}
            </div>
          </div>
        ) : error ? (
          <p className="text-[14px] font-medium text-bad" role="alert">{error}</p>
        ) : (
          <p className="text-[13px] leading-snug text-muted">Amount and what it was for, in any order. Add &ldquo;yesterday&rdquo; or a date like 10/11, and &ldquo;upi&rdquo; or &ldquo;cash&rdquo; if you like.</p>
        )}
      </div>
    </form>
  );
}
