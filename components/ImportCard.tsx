"use client";

// Settings → Import bank statement: pick a CSV, check what will be added, import.
import { useRef, useState } from "react";
import { CATEGORIES, kindOf, type Category } from "@/lib/categories";
import { dateText, useI18n } from "@/lib/i18n";
import { rupees } from "@/lib/money";
import { planImport, readStatement, type ImportItem } from "@/lib/statement";
import type { Expense } from "@/lib/types";
import type { Account } from "@/lib/wealth";
import { Sheet, SheetHead, btnLine, btnPrimary, card } from "./ui";

export function ImportCard({ rows, learned, accounts, onImport }: {
  rows: Expense[]; learned: ReadonlyMap<string, Category>; accounts: Account[];
  onImport: (items: ImportItem[], accountId: string | null) => Promise<void>;
}) {
  const i = useI18n();
  const { t } = i;
  const m = t.importer;
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<{ items: ImportItem[]; skipped: number } | null>(null);
  const [account, setAccount] = useState<string>("");

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    setError(null);
    if (!f) return;
    if (f.size > 10_000_000) { setError(m.tooBig); return; }
    const r = readStatement(await f.text());
    if (!r.ok) { setError(r.code === "noHeader" ? m.noHeader : r.code === "noRows" ? m.noRows : m.tooBig); return; }
    setPlan({ items: planImport(r.rows, rows, learned), skipped: r.skipped });
    setAccount(accounts.find(a => a.type === "bank")?.id ?? "");
  }
  const set = (idx: number, p: Partial<ImportItem>) => setPlan(pl => pl && { ...pl, items: pl.items.map((x, j) => (j === idx ? { ...x, ...p } : x)) });
  const chosen = plan?.items.filter(x => x.include).length ?? 0;

  return (
    <div className={`${card} p-4`}>
      <h2 className="font-semibold">{m.title}</h2>
      <p className="mt-0.5 text-sm text-muted">{m.help}</p>
      <button type="button" onClick={() => input.current?.click()} className={`${btnLine} mt-3`}>{m.pick}</button>
      <input ref={input} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain,text/tab-separated-values" onChange={e => void pick(e)} className="hidden" aria-hidden tabIndex={-1} data-testid="statement-input" />
      {error && <p role="alert" className="mt-2 text-sm font-medium text-bad" data-testid="import-error">{error}</p>}

      <Sheet open={!!plan} onClose={() => setPlan(null)} label={m.title}>
        {plan && (
          <div>
            <SheetHead title={m.title} onClose={() => setPlan(null)} />
            <p className="text-[14px]" data-testid="import-found">{m.found(plan.items.length, plan.skipped)}</p>
            {accounts.length > 0 && (
              <label className="mt-2 block text-sm font-medium">{m.forAccount}
                <select value={account} onChange={e => setAccount(e.target.value)} className="field mt-1">
                  <option value="">{t.wealth.noAccount}</option>
                  {accounts.filter(a => a.type !== "cash").map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </label>
            )}
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => setPlan(pl => pl && { ...pl, items: pl.items.map(x => ({ ...x, include: true })) })} className="press min-h-11 rounded-lg px-2 text-[13px] font-medium underline underline-offset-2">{m.all}</button>
              <button type="button" onClick={() => setPlan(pl => pl && { ...pl, items: pl.items.map(x => ({ ...x, include: false })) })} className="press min-h-11 rounded-lg px-2 text-[13px] font-medium underline underline-offset-2">{m.clear}</button>
            </div>
            <ul className="-mx-4 max-h-[50dvh] divide-y divide-line overflow-y-auto border-y border-line" data-testid="import-rows">
              {plan.items.map((x, idx) => {
                const inc = x.row.dir === "in";
                return (
                  <li key={idx} className={`flex items-start gap-3 px-4 py-2 ${x.include ? "" : "opacity-60"}`}>
                    <input type="checkbox" checked={x.include} onChange={e => set(idx, { include: e.target.checked })} aria-label={`${x.row.note} ${rupees(x.row.amountPaise)}`} className="mt-1.5 size-5 shrink-0 accent-[var(--accent)]" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[15px] font-medium">{x.row.note}</span>
                        <span className={`num shrink-0 font-semibold ${inc ? "text-accent" : ""}`}>{inc ? "+" : ""}{rupees(x.row.amountPaise)}</span>
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
                        <span>{dateText(x.row.date, i)}</span>
                        <select aria-label={t.add.category} value={x.category} onChange={e => set(idx, { category: e.target.value as Category })} className="rounded-md border border-line bg-card px-1 py-0.5 text-[13px] text-fg">
                          {CATEGORIES.filter(c => (inc ? kindOf(c.key) === "in" : kindOf(c.key) !== "in")).map(c => <option key={c.key} value={c.key}>{t.cat[c.key]}</option>)}
                        </select>
                        {x.reason && <span className="font-medium text-warn">{m[x.reason]}</span>}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setPlan(null)} className={btnLine}>{t.cancel}</button>
              <button type="button" disabled={!chosen} data-testid="import-go"
                onClick={async () => { const p = plan; setPlan(null); await onImport(p.items.filter(x => x.include), account || null); }}
                className={`${btnPrimary} flex-1`}>{m.go(chosen)}</button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
