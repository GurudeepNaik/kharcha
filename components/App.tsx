"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { APP_NAME } from "@/lib/brand";
import { keyWord, type Category } from "@/lib/categories";
import { dayLabel, monthOf, today } from "@/lib/dates";
import { rupees } from "@/lib/money";
import type { Parsed } from "@/lib/parse";
import { allExpenses, applyRestore, deleteExpense, getSettings, keepData, learn, learnedMap, newId, putExpense, saveSettings } from "@/lib/store";
import { byDay, inMonth, onDay, sortRows, sum } from "@/lib/totals";
import { DEFAULT_SETTINGS, type Expense, type Settings } from "@/lib/types";
import { categoryLabel } from "@/lib/categories";
import { AddBox } from "./AddBox";
import { EditSheet } from "./EditSheet";
import { InstallButton } from "./InstallButton";
import { LimitLine } from "./LimitLine";
import { MonthView } from "./MonthView";
import { SettingsView } from "./SettingsView";
import { ThemeToggle } from "./ThemeToggle";
import { Icon, SpendRow, Svg, Toast, type ToastMsg } from "./ui";

type Tab = "home" | "month" | "settings";
const TABS: { key: Tab; label: string }[] = [{ key: "home", label: "Home" }, { key: "month", label: "Month" }, { key: "settings", label: "Settings" }];
const tabFromHash = (): Tab => (location.hash === "#month" ? "month" : location.hash === "#settings" ? "settings" : "home");
const PAGE = 60;
const DAY_MS = 86_400_000;

export function App() {
  const [rows, setRows] = useState<Expense[] | null>(null);
  const [learned, setLearned] = useState<Map<string, Category>>(new Map());
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [persisted, setPersisted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab>("home");
  const [now, setNow] = useState("");
  const [editing, setEditing] = useState<Expense | null>(null);
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [typing, setTyping] = useState(false);
  const toastId = useRef(0);

  const say = useCallback((text: string, undo?: () => void) => setToast({ id: ++toastId.current, text, undo }), []);
  const clearToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    setNow(today());
    setTab(tabFromHash());
    Promise.all([allExpenses(), learnedMap(), getSettings()])
      .then(([r, l, s]) => { setRows(r); setLearned(l); setSettings(s); })
      .catch(() => setFailed(true));
    void navigator.storage?.persisted?.().then(setPersisted).catch(() => undefined);
    // The day can change while the app sits open (or in the background overnight).
    const tick = () => setNow(today());
    const onVis = () => { if (document.visibilityState === "visible") tick(); };
    const onHash = () => setTab(tabFromHash());
    const iv = setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", onVis);
    addEventListener("hashchange", onHash);
    // Hide the bottom bar while the keyboard is up.
    const isField = (t: EventTarget | null) => t instanceof HTMLElement && t.matches("input:not([type=radio]):not([type=file]), textarea");
    const fin = (e: FocusEvent) => { if (isField(e.target)) setTyping(true); };
    const fout = (e: FocusEvent) => { if (isField(e.target)) setTyping(false); };
    document.addEventListener("focusin", fin);
    document.addEventListener("focusout", fout);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
      removeEventListener("hashchange", onHash);
      document.removeEventListener("focusin", fin);
      document.removeEventListener("focusout", fout);
    };
  }, []);

  function go(t: Tab) {
    if (t === tab) { scrollTo({ top: 0, behavior: "smooth" }); return; }
    // A history entry per screen, so the phone's Back button returns to the previous one.
    history.pushState(null, "", t === "home" ? location.pathname : `#${t}`);
    setTab(t);
    scrollTo({ top: 0 });
  }

  async function remember(note: string, category: Category) {
    const w = keyWord(note);
    if (!w) return;
    await learn(w, category);
    setLearned(m => new Map(m).set(w, category));
  }

  async function add(p: Parsed, picked: boolean) {
    const at = new Date().toISOString();
    const e: Expense = { id: newId(), ...p, createdAt: at, updatedAt: at };
    await putExpense(e);
    setRows(r => sortRows([e, ...(r ?? [])]));
    if (picked) await remember(e.note, e.category);
    if (!persisted) void keepData().then(setPersisted);
    say(`Saved ${rupees(e.amountPaise)} · ${categoryLabel(e.category)}${e.date !== now ? ` · ${dayLabel(e.date, now)}` : ""}`, () => void remove(e, true));
  }

  async function save(e: Expense, categoryChanged: boolean) {
    await putExpense(e);
    setRows(r => sortRows((r ?? []).map(x => (x.id === e.id ? e : x))));
    if (categoryChanged) await remember(e.note, e.category);
    setEditing(null);
    say("Changes saved");
  }

  async function remove(e: Expense, quiet = false) {
    await deleteExpense(e.id);
    setRows(r => (r ?? []).filter(x => x.id !== e.id));
    setEditing(null);
    if (quiet) { say("Removed"); return; }
    say(`Deleted ${rupees(e.amountPaise)} ${e.note || categoryLabel(e.category)}`, async () => {
      await putExpense(e);
      setRows(r => sortRows([e, ...(r ?? []).filter(x => x.id !== e.id)]));
    });
  }

  async function updateSettings(s: Partial<Settings>) {
    await saveSettings(s);
    setSettings(cur => ({ ...cur, ...s }));
  }

  if (failed) {
    return <Shell tab={tab} go={go} typing={false}><p className="mt-10 text-center text-bad" role="alert">This browser won&rsquo;t let {APP_NAME} save data. Private or incognito windows often block it; open the app in a normal window.</p></Shell>;
  }
  if (!rows || !now) return <Shell tab={tab} go={go} typing={false}><p className="mt-10 text-center text-muted">Loading…</p></Shell>;

  const month = monthOf(now);
  const todayTotal = sum(onDay(rows, now));
  const monthTotal = sum(inMonth(rows, month));
  const oldest = rows.length ? Date.parse(rows.reduce((a, e) => (e.createdAt < a ? e.createdAt : a), rows[0]!.createdAt)) : Date.now();
  const since = settings.lastBackupAt ? Date.parse(settings.lastBackupAt) : oldest;
  const needBackup = rows.length >= 20 && Date.now() - since >= 30 * DAY_MS;
  const days = byDay(rows.slice(0, shown));

  return (
    <Shell tab={tab} go={go} typing={typing}>
      {tab === "home" && (
        <>
          <h1 className="sr-only">{APP_NAME}: add a spend</h1>
          <AddBox now={now} learned={learned} onAdd={add} />

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-line bg-card p-4">
              <p className="text-sm text-muted">Today</p>
              <p className="num mt-0.5 text-2xl font-bold" data-testid="today-total">{rupees(todayTotal)}</p>
            </div>
            <button type="button" onClick={() => go("month")} className="press rounded-2xl border border-line bg-card p-4 text-left">
              <p className="text-sm text-muted">This month</p>
              <p className="num mt-0.5 text-2xl font-bold" data-testid="home-month-total">{rupees(monthTotal)}</p>
            </button>
          </div>
          {settings.monthlyLimitPaise && (
            <div className="mt-3 rounded-2xl border border-line bg-card px-4 pt-1 pb-3">
              <LimitLine spent={monthTotal} limit={settings.monthlyLimitPaise} month={month} now={now} />
            </div>
          )}

          {needBackup && (
            <div className="mt-3 flex items-center gap-3 rounded-2xl bg-warn-soft p-3 ps-4 text-[14px]" role="note">
              <p className="flex-1">Back up your spends so you don&rsquo;t lose them.</p>
              <button type="button" onClick={() => go("settings")} className="press min-h-11 shrink-0 rounded-xl bg-card px-3 font-semibold">Back up</button>
            </div>
          )}

          <section aria-labelledby="recent" className="mt-6">
            <h2 id="recent" className="mb-2 px-1 text-sm font-semibold text-muted">Recent</h2>
            {rows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line p-6 text-center">
                <p className="font-medium">Nothing noted yet</p>
                <p className="mt-1 text-sm text-muted">Type something like <strong>chai 20</strong> or <strong>auto 80 upi</strong> in the box above and tap Save.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {days.map(d => (
                  <div key={d.date} className="overflow-hidden rounded-2xl border border-line bg-card">
                    <h3 className="flex items-baseline justify-between border-b border-line px-4 py-2 text-[13px] font-semibold text-muted">
                      <span>{dayLabel(d.date, now)}</span><span className="num">{rupees(d.paise)}</span>
                    </h3>
                    <ul className="divide-y divide-line">{d.rows.map(e => <SpendRow key={e.id} e={e} onOpen={setEditing} />)}</ul>
                  </div>
                ))}
                {rows.length > shown && (
                  <button type="button" onClick={() => setShown(s => s + PAGE)} className="press min-h-12 w-full rounded-xl border border-line bg-card font-semibold">
                    Show older spends
                  </button>
                )}
              </div>
            )}
          </section>
        </>
      )}
      {tab === "month" && <MonthView rows={rows} now={now} settings={settings} onOpen={setEditing} />}
      {tab === "settings" && (
        <SettingsView rows={rows} learned={learned} settings={settings} persisted={persisted} onSettings={updateSettings} say={t => say(t)}
          onRestore={async p => {
            await applyRestore([...p.add, ...p.update], p.backup.learned);
            if (!settings.monthlyLimitPaise && p.backup.settings.monthlyLimitPaise) await updateSettings({ monthlyLimitPaise: p.backup.settings.monthlyLimitPaise });
            const [r, l] = await Promise.all([allExpenses(), learnedMap()]);
            setRows(r); setLearned(l);
            say(`Restored: ${p.add.length} added, ${p.update.length} updated`);
          }} />
      )}

      <EditSheet expense={editing} now={now} onClose={() => setEditing(null)} onSave={save} onDelete={e => remove(e)} />
      <Toast msg={toast} onDone={clearToast} />
    </Shell>
  );
}

function Shell({ tab, go, typing, children }: { tab: Tab; go: (t: Tab) => void; typing: boolean; children: React.ReactNode }) {
  return (
    <>
      <header className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="flex items-center gap-2.5">
          <svg viewBox="0 0 512 512" width="32" height="32" aria-hidden className="shrink-0">
            <rect width="512" height="512" rx="112" fill="var(--accent)" />
            <path d="M168 150h176M168 226h176M168 150c92 0 92 152 0 152l150 92" fill="none" stroke="var(--accent-fg)" strokeWidth="40" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[17px] font-bold tracking-tight">{APP_NAME}</span>
        </div>
        <div className="flex items-center gap-2">
          <InstallButton />
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))]">{children}</main>
      <nav aria-label="Screens" data-hidden={typing} className="tabbar fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <ul className="mx-auto grid max-w-xl grid-cols-3">
          {TABS.map(t => (
            <li key={t.key}>
              <button type="button" onClick={() => go(t.key)} aria-current={tab === t.key ? "page" : undefined}
                className="press flex min-h-16 w-full flex-col items-center justify-center gap-0.5 text-[12px] font-semibold text-muted aria-[current=page]:text-accent">
                <Svg>{Icon[t.key]}</Svg>
                {t.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
