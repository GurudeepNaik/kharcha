"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { APP_NAME } from "@/lib/brand";
import { isIncomeCategory, isSpendCategory, keyWord, type Category } from "@/lib/categories";
import { monthOf, today } from "@/lib/dates";
import type { Debt, Direction } from "@/lib/debts";
import { I18nContext, MESSAGES, dateText, dayText, initialLang, localeOf, storeLang, type I18n, type Lang } from "@/lib/i18n";
import { rupees } from "@/lib/money";
import type { Parsed } from "@/lib/parse";
import { dueRepeats, nextDate, repeatFrom, skipNext } from "@/lib/repeat";
import { readImageText, takeInbox } from "@/lib/ocr";
import { base64ToBlob, compressPhoto } from "@/lib/image";
import type { ImportItem } from "@/lib/statement";
import type { Account, Goal, Holding, Transfer } from "@/lib/wealth";
import { receiptToLine } from "@/lib/receipt";
import { sharedToLine } from "@/lib/share";
import {
  all, allDebts, allExpenses, allRepeats, applyDue, applyRestore, del, deleteDebt, deleteExpense, deletePhoto, deleteRepeat, getPhoto, getSettings, keepData, learn, learnedMap, newId,
  put, putDebt, putExpense, putPhoto, putRepeat, saveSettings,
} from "@/lib/store";
import { inMonth, sortRows, sum } from "@/lib/totals";
import { DEFAULT_SETTINGS, type Expense, type Repeat, type Settings } from "@/lib/types";
import { AddBox, type AddBoxHandle, type DebtInput } from "./AddBox";
import { EditSheet } from "./EditSheet";
import { HomeView } from "./HomeView";
import { InstallButton } from "./InstallButton";
import { MonthView } from "./MonthView";
import { PeopleView } from "./PeopleView";
import { SettingsView } from "./SettingsView";
import { ThemeToggle } from "./ThemeToggle";
import { WealthView, type ListName } from "./WealthView";
import { Icon, Svg, Toast, card, type ToastMsg } from "./ui";

type Tab = "home" | "month" | "wealth" | "people" | "settings";
const TABS: Tab[] = ["home", "month", "wealth", "people", "settings"];
const tabFromHash = (): Tab => { const h = location.hash.slice(1); return (TABS as string[]).includes(h) ? (h as Tab) : "home"; };

export function App() {
  const [lang, setLangState] = useState<Lang>("en");
  const [rows, setRows] = useState<Expense[] | null>(null);
  const [learned, setLearned] = useState<Map<string, Category>>(new Map());
  const [repeats, setRepeats] = useState<Repeat[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [persisted, setPersisted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab>("home");
  const [now, setNow] = useState("");
  const [editing, setEditing] = useState<Expense | null>(null);
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const [typing, setTyping] = useState(false);
  const toastId = useRef(0);
  const addBox = useRef<AddBoxHandle>(null);
  const pending = useRef<{ fill?: string; focus?: boolean; inbox?: boolean; lost?: boolean } | null>(null);
  const [receipt, setReceipt] = useState<{ url: string; status: "reading" | "done" | "failed"; blob: Blob; keep: boolean } | null>(null);

  const i18n: I18n = useMemo(() => ({
    lang, t: MESSAGES[lang], locale: localeOf(lang),
    setLang: (l: Lang) => { storeLang(l); setLangState(l); },
  }), [lang]);
  const t = i18n.t;

  const say = useCallback((text: string, undo?: () => void) => setToast({ id: ++toastId.current, text, undo }), []);
  const clearToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    const l = initialLang();
    setLangState(l); document.documentElement.lang = `${l}-IN`;
    setNow(today());
    // Opened from the share sheet (a payment shared from a UPI app) or the home-screen shortcut.
    const q = new URLSearchParams(location.search);
    if (q.get("shared") === "1") pending.current = { inbox: true };
    else if (q.get("shared") === "0") pending.current = { lost: true };
    else if (q.has("text") || q.has("title") || q.has("url")) {
      const line = sharedToLine(q.get("title") ?? "", q.get("text") ?? "", q.get("url") ?? "");
      if (line) pending.current = { fill: line };
    } else if (q.get("add") === "1") pending.current = { focus: true };
    if (location.search) history.replaceState(null, "", location.pathname + location.hash);
    setTab(pending.current ? "home" : tabFromHash());

    Promise.all([allExpenses(), learnedMap(), getSettings(), allRepeats(), allDebts(), all("accounts"), all("transfers"), all("holdings"), all("goals")])
      .then(([r, l2, s, rp, d, ac, tr, ho, go]) => { setRows(r); setLearned(l2); setSettings(s); setRepeats(rp); setDebts(d); setAccounts(ac); setTransfers(tr); setHoldings(ho); setGoals(go); })
      .catch(() => setFailed(true));
    void navigator.storage?.persisted?.().then(setPersisted).catch(() => undefined);
    const tick = () => setNow(today());
    const onVis = () => { if (document.visibilityState === "visible") tick(); };
    const onHash = () => setTab(tabFromHash());
    const iv = setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", onVis);
    addEventListener("hashchange", onHash);
    const isField = (x: EventTarget | null) => x instanceof HTMLElement && x.matches("input:not([type=radio]):not([type=checkbox]):not([type=file]):not([type=date]), textarea");
    const fin = (e: FocusEvent) => { if (isField(e.target)) setTyping(true); };
    const fout = (e: FocusEvent) => { if (isField(e.target)) setTyping(false); };
    document.addEventListener("focusin", fin);
    document.addEventListener("focusout", fout);
    // iPhone doesn't shrink the page for the keyboard: measure it so the add box can sit on top of it.
    const vv = window.visualViewport;
    const onVV = () => { if (vv) document.documentElement.style.setProperty("--kb", `${Math.max(0, innerHeight - vv.height - vv.offsetTop)}px`); };
    vv?.addEventListener("resize", onVV);
    vv?.addEventListener("scroll", onVV);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
      removeEventListener("hashchange", onHash);
      document.removeEventListener("focusin", fin);
      document.removeEventListener("focusout", fout);
      vv?.removeEventListener("resize", onVV);
      vv?.removeEventListener("scroll", onVV);
    };
  }, []);

  const loaded = rows !== null;
  // Shared text / shortcut: once the add box exists, fill or focus it.
  useEffect(() => {
    if (!loaded || !pending.current) return;
    const p = pending.current; pending.current = null;
    if (p.inbox) { void openInbox(); return; }
    if (p.lost) { say(MESSAGES[initialLang()].receipt.lost); return; }
    setTimeout(() => { if (p.fill) addBox.current?.fill(p.fill); else if (p.focus) addBox.current?.focus(); }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  /** A payment shared from another app: text is read straight away; a receipt image is read on the phone. */
  async function openInbox() {
    const box = await takeInbox().catch(() => null);
    if (!box) { say(MESSAGES[initialLang()].receipt.lost); return; }
    const fromText = sharedToLine(box.title, box.text, box.url);
    if (!box.file) { if (fromText) addBox.current?.fill(fromText); else addBox.current?.focus(); return; }
    setReceipt({ url: URL.createObjectURL(box.file), status: "reading", blob: box.file, keep: true });
    let line: string | null = null;
    try { line = receiptToLine(await readImageText(box.file)); } catch (err) { console.warn("receipt reader failed", err); line = null; }
    line ??= fromText;
    setReceipt(r => (r ? { ...r, status: line ? "done" : "failed" } : r));
    if (line) addBox.current?.fill(line); else addBox.current?.focus();
  }
  function closeReceipt() { setReceipt(r => { if (r) URL.revokeObjectURL(r.url); return null; }); }

  /** Adds monthly entries that have come due (on open, and when the day changes). */
  const runDue = useCallback(async (rules: Repeat[], day: string) => {
    if (!rules.length || !day) return;
    const due = dueRepeats(rules, day, new Date().toISOString());
    if (!due.entries.length) return;
    const added = await applyDue(due.entries, due.rules);
    const [r, rp] = await Promise.all([allExpenses(), allRepeats()]);
    setRows(r); setRepeats(rp);
    if (added.length) say(MESSAGES[lang].toast.added(added.length, [...new Set(added.map(e => e.note || MESSAGES[lang].cat[e.category]))].slice(0, 3).join(", ")));
  }, [say, lang]);
  useEffect(() => { if (loaded) void runDue(repeats, now); }, [loaded, now, repeats, runDue]);

  function go(to: Tab) {
    if (to === tab) { scrollTo({ top: 0, behavior: "smooth" }); return; }
    history.pushState(null, "", to === "home" ? location.pathname : `#${to}`);
    setTab(to);
    scrollTo({ top: 0 });
  }

  async function remember(note: string, category: Category) {
    const w = keyWord(note);
    if (!w) return;
    await learn(w, category);
    setLearned(m => new Map(m).set(w, category));
  }

  async function startRepeat(e: Expense): Promise<Expense> {
    const rule = repeatFrom(e, newId(), new Date().toISOString());
    await putRepeat(rule);
    const linked = { ...e, repeatId: rule.id };
    await putExpense(linked);
    setRepeats(rp => [...rp, rule]); // runDue then catches up any months since the entry's date
    return linked;
  }

  /** "Food is ₹200 over budget this month", after a save that crosses a category budget. */
  function budgetNote(all: Expense[], e: Expense): string {
    if (!isSpendCategory(e.category)) return "";
    const budget = settings.categoryLimits[e.category];
    if (!budget) return "";
    const spent = sum(inMonth(all, monthOf(e.date)).filter(x => x.category === e.category));
    return spent > budget ? ` ${t.toast.overBudget(t.cat[e.category], spent - budget)}` : "";
  }

  async function add(p: Parsed, picked: boolean, everyMonth: boolean, accountId?: string | null) {
    const at = new Date().toISOString();
    let e: Expense = { id: newId(), ...p, createdAt: at, updatedAt: at };
    // Account: the one picked, else the default for UPI or cash payments.
    const acct = accountId !== undefined ? accountId : p.method === "upi" ? settings.upiAccount : p.method === "cash" ? settings.cashAccount : null;
    if (acct) e.accountId = acct;
    // A receipt shared in is kept with the entry unless the person said not to.
    if (receipt?.keep) { try { await putPhoto(e.id, await compressPhoto(receipt.blob)); e.photo = true; } catch { /* keep the entry without it */ } }
    await putExpense(e);
    if (everyMonth) e = await startRepeat(e);
    const next = sortRows([e, ...(rows ?? []).filter(x => x.id !== e.id)]);
    setRows(r => sortRows([e, ...(r ?? []).filter(x => x.id !== e.id)]));
    if (picked) await remember(e.note, e.category);
    if (!persisted) void keepData().then(setPersisted);
    closeReceipt();
    const inc = isIncomeCategory(e.category);
    const extra = `${e.date !== now ? ` · ${dayText(e.date, now, i18n)}` : ""}${everyMonth ? t.toast.monthly : ""}`;
    say(t.toast.saved(`${inc ? "+" : ""}${rupees(e.amountPaise)}`, t.cat[e.category], extra) + budgetNote(next, e), everyMonth ? undefined : () => void remove(e, true));
  }

  async function save(e: Expense, categoryChanged: boolean, everyMonth: boolean) {
    const rule = e.repeatId ? repeats.find(r => r.id === e.repeatId) : undefined;
    let out = e;
    if (everyMonth && rule) {
      const nextRule = { ...rule, amountPaise: e.amountPaise, note: e.note, category: e.category, method: e.method, day: Number(e.date.slice(8)) };
      await putRepeat(nextRule);
      setRepeats(rp => rp.map(r => (r.id === nextRule.id ? nextRule : r)));
      await putExpense(e);
    } else if (everyMonth && !rule) {
      await putExpense(e);
      out = await startRepeat(e);
    } else {
      if (rule) { await deleteRepeat(rule.id); setRepeats(rp => rp.filter(r => r.id !== rule.id)); }
      await putExpense(e);
    }
    setRows(r => sortRows((r ?? []).map(x => (x.id === out.id ? out : x))));
    if (categoryChanged) await remember(e.note, e.category);
    setEditing(null);
    say(everyMonth && !rule ? t.toast.repeatOn : !everyMonth && rule ? t.toast.repeatOff : t.toast.changes);
  }

  async function remove(e: Expense, quiet = false) {
    const photo = e.photo ? await getPhoto(e.id) : null;
    await deleteExpense(e.id);
    if (photo) await deletePhoto(e.id);
    setRows(r => (r ?? []).filter(x => x.id !== e.id));
    setEditing(null);
    if (quiet) { say(t.toast.removed); return; }
    say(t.toast.deleted(`${rupees(e.amountPaise)} ${e.note || t.cat[e.category]}`), async () => {
      if (photo) await putPhoto(e.id, photo);
      await putExpense(e);
      setRows(r => sortRows([e, ...(r ?? []).filter(x => x.id !== e.id)]));
    });
  }

  /** Skip the next one only: nothing is added that month, and it carries on after. */
  async function skipRepeat(r: Repeat) {
    const next = skipNext(r);
    await putRepeat(next);
    setRepeats(rp => rp.map(x => (x.id === r.id ? next : x)));
    say(t.toast.skipped(r.note || t.cat[r.category], dateText(nextDate(r), i18n)), async () => {
      await putRepeat(r);
      setRepeats(rp => rp.map(x => (x.id === r.id ? r : x)));
    });
  }

  /** An entry a repeat already added: remove it for this month; the repeat stays on. */
  async function skipThisMonth(e: Expense) {
    await deleteExpense(e.id);
    setRows(r => (r ?? []).filter(x => x.id !== e.id));
    setEditing(null);
    say(t.toast.skippedThis(e.note || t.cat[e.category]), async () => {
      await putExpense(e);
      setRows(r => sortRows([e, ...(r ?? []).filter(x => x.id !== e.id)]));
    });
  }

  async function stopRepeat(r: Repeat) {
    await deleteRepeat(r.id);
    setRepeats(rp => rp.filter(x => x.id !== r.id));
    say(t.toast.stopped(r.note || t.cat[r.category]), async () => {
      await putRepeat(r);
      setRepeats(rp => [...rp.filter(x => x.id !== r.id), r]);
    });
  }

  async function addDebt(d: DebtInput & { note?: string }) {
    const at = new Date().toISOString();
    const x: Debt = { id: newId(), person: d.person, dir: d.dir as Direction, amountPaise: d.amountPaise, note: d.note ?? "", date: d.date, createdAt: at, updatedAt: at };
    await putDebt(x);
    setDebts(ds => [...ds, x]);
    if (!persisted) void keepData().then(setPersisted);
    const text = `${x.dir === "gave" ? t.add.gave(x.person) : t.add.got(x.person)} ${rupees(x.amountPaise)}`;
    say(d.note === t.people.settle ? t.toast.settled(x.person) : t.toast.debt(text), async () => { await deleteDebt(x.id); setDebts(ds => ds.filter(y => y.id !== x.id)); });
  }

  async function removeDebt(d: Debt) {
    await deleteDebt(d.id);
    setDebts(ds => ds.filter(x => x.id !== d.id));
    say(t.toast.deleted(`${rupees(d.amountPaise)} · ${d.person}`), async () => { await putDebt(d); setDebts(ds => [...ds.filter(x => x.id !== d.id), d]); });
  }

  /** Photo added to or removed from an entry (from the edit sheet). */
  async function setPhoto(e: Expense, file: Blob | null) {
    let next: Expense;
    if (file) { await putPhoto(e.id, await compressPhoto(file)); next = { ...e, photo: true, updatedAt: new Date().toISOString() }; }
    else { await deletePhoto(e.id); next = { ...e, updatedAt: new Date().toISOString() }; delete next.photo; }
    await putExpense(next);
    setRows(r => sortRows((r ?? []).map(x => (x.id === next.id ? next : x))));
    setEditing(next);
  }

  const setters = { accounts: setAccounts, transfers: setTransfers, holdings: setHoldings, goals: setGoals } as const;
  async function saveItem(list: ListName, item: Account | Transfer | Holding | Goal) {
    await put(list, item as never);
    (setters[list] as unknown as (f: (xs: { id: string }[]) => { id: string }[]) => void)(xs => [...xs.filter(x => x.id !== item.id), item]);
  }
  async function deleteItem(list: ListName, id: string) {
    await del(list, id);
    (setters[list] as unknown as (f: (xs: { id: string }[]) => { id: string }[]) => void)(xs => xs.filter(x => x.id !== id));
    if (list === "accounts") {
      const patch: Partial<Settings> = {};
      if (settings.upiAccount === id) patch.upiAccount = null;
      if (settings.cashAccount === id) patch.cashAccount = null;
      if (Object.keys(patch).length) await updateSettings(patch);
    }
  }

  /** Statement rows the person kept ticked become entries, in one go (Undo removes them all). */
  async function importRows(items: ImportItem[], accountId: string | null) {
    const at = new Date().toISOString();
    const made: Expense[] = items.map(x => {
      const e: Expense = { id: newId(), amountPaise: x.row.amountPaise, note: x.row.note.slice(0, 60), category: x.category, method: x.row.method, date: x.row.date, createdAt: at, updatedAt: at };
      if (accountId) e.accountId = accountId;
      return e;
    });
    await applyRestore(made, []);
    setRows(r => sortRows([...made, ...(r ?? [])]));
    if (!persisted) void keepData().then(setPersisted);
    say(t.importer.done(made.length), async () => {
      for (const e of made) await deleteExpense(e.id);
      const ids = new Set(made.map(e => e.id));
      setRows(r => (r ?? []).filter(x => !ids.has(x.id)));
    });
  }

  async function updateSettings(s: Partial<Settings>) {
    await saveSettings(s);
    setSettings(cur => ({ ...cur, ...s }));
  }

  let body: React.ReactNode;
  if (failed) body = <p className="mt-10 text-center text-bad" role="alert">{t.storageBlocked(APP_NAME)}</p>;
  else if (!rows || !now) body = <p className="mt-10 text-center text-muted">{t.loading}</p>;
  else {
    const active = new Set(repeats.map(r => r.id));
    const isRepeating = (e: Expense) => !!e.repeatId && active.has(e.repeatId);
    body = (
      <>
        {tab === "home" && (
          <>
            {receipt && (
              <div className={`mb-3 flex gap-3 ${card} p-3`} data-testid="receipt">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={receipt.url} alt={t.receipt.alt} className="h-28 w-20 shrink-0 rounded-lg border border-line object-cover object-top" />
                <div className="min-w-0 flex-1">
                  <p className={`text-[15px] font-medium ${receipt.status === "failed" ? "text-bad" : ""}`} aria-live="polite" data-testid="receipt-status">
                    {receipt.status === "reading" ? t.receipt.reading : receipt.status === "done" ? t.receipt.done : t.receipt.failed}
                  </p>
                  {receipt.status === "reading" && <p className="mt-1 text-[13px] text-muted">{t.receipt.first}</p>}
                  <label className="mt-1.5 flex min-h-11 cursor-pointer items-center gap-2 text-[13px]">
                    <input type="checkbox" checked={receipt.keep} onChange={e => setReceipt(r => r && { ...r, keep: e.target.checked })} className="size-5 accent-[var(--accent)]" data-testid="receipt-keep" />
                    {t.photo.keep}
                  </label>
                </div>
                <button type="button" onClick={closeReceipt} aria-label={t.receipt.close} className="press grid size-11 shrink-0 place-items-center rounded-full bg-soft text-muted">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </div>
            )}
            <HomeView rows={rows} now={now} settings={settings} repeats={repeats} onSkip={skipRepeat} onOpen={setEditing} onMonth={() => go("month")} onBackup={() => go("settings")} isRepeating={isRepeating} />
            <AddBox ref={addBox} now={now} learned={learned} typing={typing} accounts={accounts} settings={settings} onAdd={add} onDebt={addDebt} />
          </>
        )}
        {tab === "month" && <MonthView rows={rows} now={now} settings={settings} repeats={repeats} onOpen={setEditing} isRepeating={isRepeating} onSettings={updateSettings} />}
        {tab === "wealth" && <WealthView rows={rows} now={now} accounts={accounts} transfers={transfers} holdings={holdings} goals={goals} settings={settings}
          onSave={saveItem} onDelete={deleteItem} onSettings={updateSettings} say={x => say(x)} />}
        {tab === "people" && <PeopleView debts={debts} now={now} onAdd={addDebt} onDelete={removeDebt} />}
        {tab === "settings" && (
          <SettingsView rows={rows} learned={learned} repeats={repeats} debts={debts} settings={settings} persisted={persisted} now={now}
            extra={{ accounts, transfers, holdings, goals }} onImport={importRows}
            onSettings={updateSettings} onStopRepeat={stopRepeat} onSkipRepeat={skipRepeat} say={x => say(x)}
            onRestore={async p => {
              const b = p.backup;
              await applyRestore([...p.add, ...p.update], b.learned, b.repeats, b.debts, {
                accounts: b.accounts, transfers: b.transfers, holdings: b.holdings, goals: b.goals,
                photos: b.photos.map(x => ({ id: x.id, blob: base64ToBlob(x.data, x.type) })),
              });
              const patch: Partial<Settings> = {};
              if (!settings.monthlyLimitPaise && p.backup.settings.monthlyLimitPaise) patch.monthlyLimitPaise = p.backup.settings.monthlyLimitPaise;
              if (!Object.keys(settings.categoryLimits).length && Object.keys(p.backup.settings.categoryLimits).length) patch.categoryLimits = p.backup.settings.categoryLimits;
              if (!settings.upiAccount && b.settings.upiAccount) patch.upiAccount = b.settings.upiAccount;
              if (!settings.cashAccount && b.settings.cashAccount) patch.cashAccount = b.settings.cashAccount;
              if (Object.keys(patch).length) await updateSettings(patch);
              const [r, l, rp, d, ac, tr, ho, go] = await Promise.all([allExpenses(), learnedMap(), allRepeats(), allDebts(), all("accounts"), all("transfers"), all("holdings"), all("goals")]);
              setRows(r); setLearned(l); setRepeats(rp); setDebts(d); setAccounts(ac); setTransfers(tr); setHoldings(ho); setGoals(go);
              say(t.toast.restored(p.add.length, p.update.length));
            }} />
        )}
        <EditSheet expense={editing} repeating={!!editing && isRepeating(editing)} now={now} onClose={() => setEditing(null)} onSave={save} onDelete={e => remove(e)} onSkip={skipThisMonth} accounts={accounts} onPhoto={setPhoto} />
      </>
    );
  }

  return (
    <I18nContext.Provider value={i18n}>
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
      {/* Home leaves room for the add box docked above the bottom bar. */}
      <main className={`mx-auto max-w-xl px-4 ${tab === "home" ? "pb-[calc(13.5rem+env(safe-area-inset-bottom))]" : "pb-[calc(6.5rem+env(safe-area-inset-bottom))]"}`}>{body}</main>
      <nav aria-label={t.nav.label} data-hidden={typing} className="tabbar fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card pb-[env(safe-area-inset-bottom)]">
        <ul className="mx-auto grid max-w-xl grid-cols-5">
          {TABS.map(k => (
            <li key={k}>
              <button type="button" onClick={() => go(k)} aria-current={tab === k ? "page" : undefined} data-tab={k}
                className="press flex min-h-16 w-full flex-col items-center justify-center gap-0.5 px-1 text-[12px] leading-[1.45] font-semibold text-muted aria-[current=page]:text-accent">
                <Svg>{Icon[k]}</Svg>
                <span className="max-w-full truncate pb-px">{t.nav[k]}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <Toast msg={toast} onDone={clearToast} lift={tab === "home"} />
    </I18nContext.Provider>
  );
}
