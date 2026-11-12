"use client";

// Monthly limit, backup, restore and the spreadsheet export.
import { useEffect, useRef, useState } from "react";
import { APP_NAME } from "@/lib/brand";
import { MAX_BACKUP_BYTES, makeBackup, planRestore, readBackup, toCsv, type Backup } from "@/lib/backup";
import type { Category } from "@/lib/categories";
import { shortDate, today } from "@/lib/dates";
import { readRupees, rupees } from "@/lib/money";
import type { Expense, Settings } from "@/lib/types";
import { Sheet, SheetHead } from "./ui";

type Plan = { backup: Backup; add: Expense[]; update: Expense[]; unchanged: number };

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function SettingsView({ rows, learned, settings, persisted, onSettings, onRestore, say }: {
  rows: Expense[];
  learned: Map<string, Category>;
  settings: Settings;
  persisted: boolean;
  onSettings: (s: Partial<Settings>) => Promise<void>;
  onRestore: (plan: Plan) => Promise<void>;
  say: (text: string) => void;
}) {
  const [limit, setLimit] = useState(settings.monthlyLimitPaise ? String(settings.monthlyLimitPaise / 100) : "");
  const [limitError, setLimitError] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { setCanShare(!!navigator.canShare?.({ files: [new File(["{}"], "x.json", { type: "application/json" })] })); } catch { setCanShare(false); }
  }, []);

  async function saveLimit(e: React.FormEvent) {
    e.preventDefault();
    if (!limit.trim()) { await onSettings({ monthlyLimitPaise: null }); setLimitError(null); say("Monthly limit removed"); return; }
    const r = readRupees(limit);
    if (!r.ok) { setLimitError(r.error); return; }
    setLimitError(null);
    await onSettings({ monthlyLimitPaise: r.paise });
    say(`Monthly limit set to ${rupees(r.paise)}`);
  }

  function backupFile() {
    const name = `${APP_NAME.toLowerCase()}-backup-${today()}.json`;
    return new File([JSON.stringify(makeBackup(rows, learned, settings))], name, { type: "application/json" });
  }

  async function share() {
    const file = backupFile();
    try {
      await navigator.share({ files: [file], title: `${APP_NAME} backup` });
      await onSettings({ lastBackupAt: new Date().toISOString() });
      say("Backup shared. Keep it somewhere safe, like Drive or WhatsApp to yourself.");
    } catch (err) {
      if ((err as Error).name !== "AbortError") say("Couldn't share the backup. Use Save backup file instead.");
    }
  }

  async function saveFile() {
    const file = backupFile();
    download(file.name, file);
    await onSettings({ lastBackupAt: new Date().toISOString() });
    say("Backup file saved to your downloads");
  }

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    setFileError(null);
    if (!f) return;
    if (f.size > MAX_BACKUP_BYTES) { setFileError("This file is too big to be a backup."); return; }
    const r = readBackup(await f.text());
    if (!r.ok) { setFileError(r.error); return; }
    setPlan({ backup: r.value, ...planRestore(rows, r.value.expenses) });
  }

  return (
    <section aria-labelledby="settings-title" className="space-y-4">
      <h1 id="settings-title" className="text-lg font-bold">Settings</h1>

      <form onSubmit={saveLimit} className="rounded-2xl border border-line bg-card p-4" noValidate>
        <label htmlFor="limit" className="block font-semibold">Monthly limit</label>
        <p id="limit-help" className="mt-0.5 text-sm text-muted">Home shows how much is left this month. Leave empty for no limit.</p>
        <div className="mt-2 flex gap-2">
          <div className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden>₹</span>
            <input id="limit" value={limit} onChange={e => { setLimit(e.target.value); setLimitError(null); }} inputMode="decimal" autoComplete="off"
              placeholder="e.g. 20000" aria-describedby={limitError ? "limit-error" : "limit-help"} aria-invalid={limitError ? true : undefined}
              className="field num ps-8" />
          </div>
          <button type="submit" className="press min-h-12 rounded-xl bg-accent px-5 font-semibold text-accent-fg">Save</button>
        </div>
        {limitError && <p id="limit-error" role="alert" className="mt-2 text-sm font-medium text-bad">{limitError}</p>}
      </form>

      <div className="rounded-2xl border border-line bg-card p-4">
        <h2 className="font-semibold">Back up</h2>
        <p className="mt-0.5 text-sm text-muted">
          Your spends are saved only in this browser on this phone. Save a backup now and then, so you can get them back on a new phone or if the browser&rsquo;s data is cleared.
          {settings.lastBackupAt ? ` Last backup: ${shortDate(settings.lastBackupAt.slice(0, 10))}.` : " No backup yet."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {canShare && <button type="button" onClick={() => void share()} disabled={!rows.length} className="press min-h-12 rounded-xl bg-accent px-4 font-semibold text-accent-fg disabled:opacity-50">Share backup</button>}
          <button type="button" onClick={() => void saveFile()} disabled={!rows.length} className="press min-h-12 rounded-xl border border-line px-4 font-semibold disabled:opacity-50">Save backup file</button>
          <button type="button" onClick={() => fileInput.current?.click()} className="press min-h-12 rounded-xl border border-line px-4 font-semibold">Restore from a backup</button>
          <input ref={fileInput} type="file" accept="application/json,.json" onChange={e => void pick(e)} className="hidden" aria-hidden tabIndex={-1} data-testid="restore-input" />
        </div>
        {fileError && <p role="alert" className="mt-2 text-sm font-medium text-bad">{fileError}</p>}
        <p className="mt-3 text-[13px] text-muted">
          {persisted ? "This browser has agreed to keep your data, even when the phone is low on space." : "This browser may clear saved data when the phone is low on space. Backups keep you safe."}
        </p>
      </div>

      <div className="rounded-2xl border border-line bg-card p-4">
        <h2 className="font-semibold">Export for Excel</h2>
        <p className="mt-0.5 text-sm text-muted">Every spend as a CSV file that opens in Excel or Google Sheets.</p>
        <button type="button" disabled={!rows.length}
          onClick={() => { download(`${APP_NAME.toLowerCase()}-${today()}.csv`, new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" })); say("CSV saved to your downloads"); }}
          className="press mt-3 min-h-12 rounded-xl border border-line px-4 font-semibold disabled:opacity-50">
          Export {rows.length === 1 ? "1 spend" : `${rows.length} spends`}
        </button>
      </div>

      <Sheet open={!!plan} onClose={() => setPlan(null)} label="Restore this backup?">
        {plan && (
          <div>
            <SheetHead title="Restore this backup?" onClose={() => setPlan(null)} />
            <p className="text-[15px]">
              {plan.backup.exportedAt && /^\d{4}-\d{2}-\d{2}/.test(plan.backup.exportedAt) ? `Backup from ${shortDate(plan.backup.exportedAt.slice(0, 10))}, ` : "This backup has "}
              {plan.backup.expenses.length === 1 ? "1 spend" : `${plan.backup.expenses.length} spends`}.
            </p>
            <ul className="mt-2 space-y-0.5 text-[15px]" data-testid="restore-plan">
              <li><strong className="num">{plan.add.length}</strong> new, will be added</li>
              <li><strong className="num">{plan.update.length}</strong> changed since, will be updated</li>
              <li><strong className="num">{plan.unchanged}</strong> already here, left as they are</li>
            </ul>
            <p className="mt-2 text-sm text-muted">Nothing on this phone is deleted.</p>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setPlan(null)} className="press min-h-12 rounded-xl border border-line px-4 font-semibold">Cancel</button>
              <button type="button" disabled={!plan.add.length && !plan.update.length}
                onClick={async () => { const p = plan; setPlan(null); await onRestore(p); }}
                className="press min-h-12 flex-1 rounded-xl bg-accent font-semibold text-accent-fg disabled:opacity-50">
                {!plan.add.length && !plan.update.length ? "Nothing to restore" : "Restore"}
              </button>
            </div>
          </div>
        )}
      </Sheet>
    </section>
  );
}
