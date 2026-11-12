"use client";

// Language, monthly limit, budgets per category, monthly repeats, backup, restore and the spreadsheet export.
import { useEffect, useRef, useState } from "react";
import { APP_NAME } from "@/lib/brand";
import { MAX_BACKUP_BYTES, makeBackup, planRestore, readBackup, toCsv, type Backup } from "@/lib/backup";
import { CATEGORIES, isIncomeCategory, type Category, type SpendCategory } from "@/lib/categories";
import { today } from "@/lib/dates";
import type { Debt } from "@/lib/debts";
import { LANGS, dateText, useI18n } from "@/lib/i18n";
import { readRupees, rupees } from "@/lib/money";
import { nextDate } from "@/lib/repeat";
import type { CategoryLimits, Expense, Repeat, Settings } from "@/lib/types";
import { Sheet, SheetHead, btnLine, btnPrimary, card } from "./ui";

export type Plan = { backup: Backup; add: Expense[]; update: Expense[]; unchanged: number };

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const SPEND_CATS = CATEGORIES.filter(c => !c.income).map(c => c.key as SpendCategory);

export function SettingsView({ rows, learned, repeats, debts, settings, persisted, now, onSettings, onStopRepeat, onRestore, say }: {
  rows: Expense[];
  learned: Map<string, Category>;
  repeats: Repeat[];
  debts: Debt[];
  settings: Settings;
  persisted: boolean;
  now: string;
  onSettings: (s: Partial<Settings>) => Promise<void>;
  onStopRepeat: (r: Repeat) => Promise<void>;
  onRestore: (plan: Plan) => Promise<void>;
  say: (text: string) => void;
}) {
  const i = useI18n();
  const { t } = i;
  const [limit, setLimit] = useState(settings.monthlyLimitPaise ? String(settings.monthlyLimitPaise / 100) : "");
  const [limitError, setLimitError] = useState<string | null>(null);
  const [budgets, setBudgets] = useState<Record<string, string>>(() => Object.fromEntries(SPEND_CATS.map(c => [c, settings.categoryLimits[c] ? String(settings.categoryLimits[c]! / 100) : ""])));
  const [budgetError, setBudgetError] = useState<{ cat: string; text: string } | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const base = APP_NAME.toLowerCase();

  useEffect(() => {
    try { setCanShare(!!navigator.canShare?.({ files: [new File(["{}"], "x.json", { type: "application/json" })] })); } catch { setCanShare(false); }
  }, []);

  async function saveLimit(e: React.FormEvent) {
    e.preventDefault();
    if (!limit.trim()) { await onSettings({ monthlyLimitPaise: null }); setLimitError(null); say(t.toast.limitOff); return; }
    const r = readRupees(limit);
    if (!r.ok) { setLimitError(t.err[r.code]); return; }
    setLimitError(null);
    await onSettings({ monthlyLimitPaise: r.paise });
    say(t.toast.limitSet(r.paise));
  }

  async function saveBudgets(e: React.FormEvent) {
    e.preventDefault();
    const out: CategoryLimits = {};
    for (const c of SPEND_CATS) {
      const v = budgets[c]?.trim();
      if (!v) continue;
      const r = readRupees(v);
      if (!r.ok) { setBudgetError({ cat: c, text: `${t.cat[c]}: ${t.err[r.code]}` }); document.getElementById(`b-${c}`)?.focus(); return; }
      out[c] = r.paise;
    }
    setBudgetError(null);
    await onSettings({ categoryLimits: out });
    say(t.toast.budgets);
  }

  function backupFile() {
    return new File([JSON.stringify(makeBackup(rows, learned, settings, repeats, debts))], `${base}-backup-${today()}.json`, { type: "application/json" });
  }
  async function share() {
    try {
      await navigator.share({ files: [backupFile()], title: `${APP_NAME} backup` });
      await onSettings({ lastBackupAt: new Date().toISOString() });
      say(t.toast.shared);
    } catch (err) {
      if ((err as Error).name !== "AbortError") say(t.toast.shareFail);
    }
  }
  async function saveFile() {
    const f = backupFile();
    download(f.name, f);
    await onSettings({ lastBackupAt: new Date().toISOString() });
    say(t.toast.backupSaved);
  }

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    setFileError(null);
    if (!f) return;
    if (f.size > MAX_BACKUP_BYTES) { setFileError(t.settings.tooBig); return; }
    const r = readBackup(await f.text());
    if (!r.ok) { setFileError(/newer/.test(r.error) ? t.settings.newer : /too big/.test(r.error) ? t.settings.tooBig : t.settings.badFile); return; }
    setPlan({ backup: r.value, ...planRestore(rows, r.value.expenses) });
  }

  const total = rows.length + debts.length;
  const nothing = (p: Plan) => !p.add.length && !p.update.length && !p.backup.debts.length && !p.backup.repeats.length;

  return (
    <section aria-labelledby="settings-title" className="space-y-4">
      <h1 id="settings-title" className="text-lg font-bold">{t.settings.title}</h1>

      <fieldset className={`${card} p-4`}>
        <legend className="float-left font-semibold">{t.settings.language}</legend>
        <div className="clear-both grid grid-cols-3 gap-2 pt-2">
          {LANGS.map(l => (
            <label key={l.key} lang={l.locale} className="press flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-line text-[15px] font-semibold has-checked:border-accent has-checked:bg-accent-soft has-focus-visible:outline-2 has-focus-visible:outline-accent">
              <input type="radio" name="lang" value={l.key} checked={i.lang === l.key} onChange={() => i.setLang(l.key)} className="sr-only" />
              {l.label}
            </label>
          ))}
        </div>
      </fieldset>

      <form onSubmit={saveLimit} className={`${card} p-4`} noValidate>
        <label htmlFor="limit" className="block font-semibold">{t.settings.limit}</label>
        <p id="limit-help" className="mt-0.5 text-sm text-muted">{t.settings.limitHelp}</p>
        <div className="mt-2 flex gap-2">
          <div className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden>₹</span>
            <input id="limit" value={limit} onChange={e => { setLimit(e.target.value); setLimitError(null); }} inputMode="decimal" autoComplete="off"
              placeholder={t.settings.limitPh} aria-describedby={limitError ? "limit-error" : "limit-help"} aria-invalid={limitError ? true : undefined} className="field num ps-8" />
          </div>
          <button type="submit" className={btnPrimary} data-testid="limit-save">{t.save}</button>
        </div>
        {limitError && <p id="limit-error" role="alert" className="mt-2 text-sm font-medium text-bad">{limitError}</p>}
      </form>

      <form onSubmit={saveBudgets} className={`${card} p-4`} noValidate aria-labelledby="budgets-title">
        <h2 id="budgets-title" className="font-semibold">{t.settings.budgets}</h2>
        <p className="mt-0.5 text-sm text-muted">{t.settings.budgetsHelp}</p>
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
          {SPEND_CATS.map(c => (
            <div key={c}>
              <label htmlFor={`b-${c}`} className="mb-1 block text-[13px] font-medium">{t.cat[c]}</label>
              <div className="relative">
                <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden>₹</span>
                <input id={`b-${c}`} value={budgets[c] ?? ""} onChange={e => { setBudgets(b => ({ ...b, [c]: e.target.value })); setBudgetError(null); }}
                  inputMode="decimal" autoComplete="off" aria-invalid={budgetError?.cat === c || undefined} className="field num ps-7" />
              </div>
            </div>
          ))}
        </div>
        {budgetError && <p role="alert" className="mt-2 text-sm font-medium text-bad">{budgetError.text}</p>}
        <button type="submit" className={`${btnPrimary} mt-3`} data-testid="budgets-save">{t.settings.budgetsSave}</button>
      </form>

      <div className={`${card} p-4`}>
        <h2 className="font-semibold">{t.settings.every}</h2>
        {repeats.length === 0 ? (
          <p className="mt-0.5 text-sm text-muted">{t.settings.everyEmpty}</p>
        ) : (
          <ul className="mt-2 divide-y divide-line" data-testid="repeats">
            {[...repeats].sort((a, b) => a.day - b.day).map(r => {
              const inc = isIncomeCategory(r.category);
              const next = nextDate(r);
              return (
                <li key={r.id} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{r.note || t.cat[r.category]} <span className={`num ${inc ? "text-accent" : ""}`}>{inc ? "+" : ""}{rupees(r.amountPaise)}</span></span>
                    <span className="block text-[13px] text-muted">{t.settings.next(next <= now ? t.today : dateText(next, i))}</span>
                  </span>
                  <button type="button" onClick={() => void onStopRepeat(r)} className="press min-h-11 shrink-0 rounded-xl border border-line px-3 text-[14px] font-semibold" data-testid="stop-repeat">{t.settings.stop}</button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className={`${card} p-4`}>
        <h2 className="font-semibold">{t.settings.backup}</h2>
        <p className="mt-0.5 text-sm text-muted">
          {t.settings.backupHelp}{settings.lastBackupAt ? t.settings.lastBackup(dateText(settings.lastBackupAt.slice(0, 10), i)) : t.settings.noBackup}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {canShare && <button type="button" onClick={() => void share()} disabled={!total} className={btnPrimary}>{t.settings.share}</button>}
          <button type="button" onClick={() => void saveFile()} disabled={!total} className={btnLine} data-testid="save-backup">{t.settings.saveFile}</button>
          <button type="button" onClick={() => fileInput.current?.click()} className={btnLine}>{t.settings.restore}</button>
          <input ref={fileInput} type="file" accept="application/json,.json" onChange={e => void pick(e)} className="hidden" aria-hidden tabIndex={-1} data-testid="restore-input" />
        </div>
        {fileError && <p role="alert" className="mt-2 text-sm font-medium text-bad" data-testid="file-error">{fileError}</p>}
        <p className="mt-3 text-[13px] text-muted">{persisted ? t.settings.persisted : t.settings.notPersisted}</p>
      </div>

      <div className={`${card} p-4`}>
        <h2 className="font-semibold">{t.settings.export}</h2>
        <p className="mt-0.5 text-sm text-muted">{t.settings.exportHelp}</p>
        <button type="button" disabled={!total} data-testid="export"
          onClick={() => { download(`${base}-${today()}.csv`, new Blob([toCsv(rows, debts)], { type: "text/csv;charset=utf-8" })); say(t.toast.csvSaved); }}
          className={`${btnLine} mt-3`}>
          {t.settings.exportN(total)}
        </button>
      </div>

      <Sheet open={!!plan} onClose={() => setPlan(null)} label={t.settings.restoreQ}>
        {plan && (
          <div>
            <SheetHead title={t.settings.restoreQ} onClose={() => setPlan(null)} />
            <p className="text-[15px]">
              {/^\d{4}-\d{2}-\d{2}/.test(plan.backup.exportedAt) ? t.settings.restoreFrom(dateText(plan.backup.exportedAt.slice(0, 10), i), plan.backup.expenses.length) : t.settings.restoreHas(plan.backup.expenses.length)}
            </p>
            <ul className="mt-2 space-y-0.5 text-[15px]" data-testid="restore-plan">
              <li><strong className="num">{plan.add.length}</strong> {t.settings.rNew}</li>
              <li><strong className="num">{plan.update.length}</strong> {t.settings.rChanged}</li>
              <li><strong className="num">{plan.unchanged}</strong> {t.settings.rSame}</li>
            </ul>
            <p className="mt-2 text-sm text-muted">{t.settings.rNoDelete}</p>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setPlan(null)} className={btnLine} data-testid="restore-cancel">{t.cancel}</button>
              <button type="button" data-testid="restore-go" disabled={nothing(plan)}
                onClick={async () => { const p = plan; setPlan(null); await onRestore(p); }}
                className={`${btnPrimary} flex-1`}>
                {nothing(plan) ? t.settings.rNothing : t.settings.rBtn}
              </button>
            </div>
          </div>
        )}
      </Sheet>
    </section>
  );
}
