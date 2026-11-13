"use client";

// Language, monthly limit, budgets per category, statement import, backup, restore and the spreadsheet export.
import { useEffect, useRef, useState } from "react";
import { APP_NAME } from "@/lib/brand";
import { MAX_BACKUP_BYTES, makeBackup, planRestore, readBackup, toCsv, type Backup } from "@/lib/backup";
import { CATEGORIES, type Category, type SpendCategory } from "@/lib/categories";
import { today } from "@/lib/dates";
import type { Debt } from "@/lib/debts";
import { LANGS, dateText, useI18n } from "@/lib/i18n";
import { readRupees } from "@/lib/money";
import type { CategoryLimits, Expense, Settings } from "@/lib/types";
import { Sheet, SheetHead, btnLine, btnPrimary, card } from "./ui";
import { ImportCard } from "./ImportCard";
import { LockCard } from "./LockCard";
import type { ImportItem } from "@/lib/statement";
import type { BackupExtra } from "@/lib/backup";
import { backupJson } from "@/lib/backupJson";
import { DriveError, connectDrive, driveEnabled, loadFromDrive, prepareDrive, saveToDrive } from "@/lib/drive";

export type Plan = { backup: Backup; add: Expense[]; update: Expense[]; unchanged: number };

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const SPEND_CATS = CATEGORIES.filter(c => c.kind === "spend").map(c => c.key as SpendCategory);

export function SettingsView({ rows, learned, debts, settings, persisted, extra, onImport, onPayments, onSettings, onRestore, say }: {
  rows: Expense[];
  learned: Map<string, Category>;
  debts: Debt[];
  extra: Required<Omit<BackupExtra, "photos">>;
  onImport: (items: ImportItem[], accountId: string | null) => Promise<void>;
  settings: Settings;
  persisted: boolean;
  onSettings: (s: Partial<Settings>) => Promise<void>;
  onPayments: () => void;
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
  const [withPhotos, setWithPhotos] = useState(false);
  const photoCount = rows.filter(e => e.photo).length;
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

  async function backupFile() {
    return new File([await backupJson(rows, learned, settings, debts, extra, withPhotos)], `${base}-backup-${today()}.json`, { type: "application/json" });
  }
  useEffect(() => { if (driveEnabled()) void prepareDrive().catch(() => undefined); }, []);
  const [driveBusy, setDriveBusy] = useState(false);
  const driveFail = (e: unknown) => { const c = e instanceof DriveError ? e.code : "failed"; if (c !== "cancelled") say(t.drive[c]); };
  async function toDrive() {
    setDriveBusy(true);
    try {
      await connectDrive();
      await saveToDrive(await backupJson(rows, learned, settings, debts, extra, true));
      await onSettings({ lastBackupAt: new Date().toISOString(), driveOn: true });
      say(t.drive.saved);
    } catch (e) { driveFail(e); } finally { setDriveBusy(false); }
  }
  async function fromDrive() {
    setDriveBusy(true); setFileError(null);
    try {
      await connectDrive();
      const { text } = await loadFromDrive();
      const r = readBackup(text);
      if (!r.ok) { setFileError(/newer/.test(r.error) ? t.settings.newer : t.settings.badFile); return; }
      setPlan({ backup: r.value, ...planRestore(rows, r.value.expenses) });
    } catch (e) { driveFail(e); } finally { setDriveBusy(false); }
  }
  async function share() {
    try {
      await navigator.share({ files: [await backupFile()], title: `${APP_NAME} backup` });
      await onSettings({ lastBackupAt: new Date().toISOString() });
      say(t.toast.shared);
    } catch (err) {
      if ((err as Error).name !== "AbortError") say(t.toast.shareFail);
    }
  }
  async function saveFile() {
    const f = await backupFile();
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
  const nothing = (p: Plan) => !p.add.length && !p.update.length && ![p.backup.debts, p.backup.repeats, p.backup.plan, p.backup.accounts, p.backup.transfers, p.backup.holdings, p.backup.goals, p.backup.photos].some(x => x.length);

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

      <div className={`${card} flex items-center gap-3 p-4`}>
        <p className="min-w-0 flex-1 text-sm text-muted">{t.pay.empty}</p>
        <button type="button" onClick={onPayments} className={`${btnLine} shrink-0`}>{t.pay.title}</button>
      </div>

      <LockCard lock={settings.lock} onSettings={onSettings} say={say} />

      <ImportCard rows={rows} learned={learned} accounts={extra.accounts} onImport={onImport} />

      <div className={`${card} p-4`}>
        <h2 className="font-semibold">{t.settings.backup}</h2>
        <p className="mt-0.5 text-sm text-muted">
          {t.settings.backupHelp}{settings.lastBackupAt ? t.settings.lastBackup(dateText(settings.lastBackupAt.slice(0, 10), i)) : t.settings.noBackup}
        </p>
        {driveEnabled() && (
          <div className="mt-3 rounded-xl bg-soft/60 p-3" data-testid="drive">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void toDrive()} disabled={!total || driveBusy} className={btnPrimary} data-testid="drive-backup">{driveBusy ? t.drive.working : t.drive.backup}</button>
              <button type="button" onClick={() => void fromDrive()} disabled={driveBusy} className={btnLine} data-testid="drive-restore">{t.drive.restore}</button>
            </div>
            <p className="mt-2 text-[13px] text-muted">{t.drive.help}</p>
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {canShare && <button type="button" onClick={() => void share()} disabled={!total} className={btnPrimary}>{t.settings.share}</button>}
          <button type="button" onClick={() => void saveFile()} disabled={!total} className={btnLine} data-testid="save-backup">{t.settings.saveFile}</button>
          <button type="button" onClick={() => fileInput.current?.click()} className={btnLine}>{t.settings.restore}</button>
          <input ref={fileInput} type="file" accept="application/json,.json" onChange={e => void pick(e)} className="hidden" aria-hidden tabIndex={-1} data-testid="restore-input" />
        </div>
        {photoCount > 0 && (
          <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-2 text-[14px]">
            <input type="checkbox" checked={withPhotos} onChange={e => setWithPhotos(e.target.checked)} className="size-5 accent-[var(--accent)]" data-testid="backup-photos" />
            {t.photo.include}
          </label>
        )}
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
