"use client";

// Lent and borrowed: who owes you, whom you owe, and each person's history.
import { useState } from "react";
import { UPI_ID, balances, daysBetween, owedToYou, personKey, whatsappLink, youOwe, type Balance, type Debt, type Direction } from "@/lib/debts";
import type { I18n } from "@/lib/i18n";
import { dateText, useI18n } from "@/lib/i18n";
import { readRupees, rupees } from "@/lib/money";
import { Sheet, SheetHead, btnLine, btnPrimary, card } from "./ui";

/** The WhatsApp message for someone who owes you. */
export function reminderText(b: Balance, i: I18n, upi: string | null) {
  return i.t.people.message(b.name, b.paise, dateText(b.since, i), b.notes.slice(-3).join(", "), upi ?? "");
}

export function PeopleView({ debts, now, onAdd, onDelete, upiId, onUpi }: {
  debts: Debt[]; now: string; upiId: string | null; onUpi: (v: string | null) => Promise<void>;
  onAdd: (d: { person: string; dir: Direction; amountPaise: number; note: string; date: string }) => Promise<void>;
  onDelete: (d: Debt) => Promise<void>;
}) {
  const i = useI18n();
  const { t } = i;
  const bs = balances(debts);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const open = bs.find(b => b.key === openKey) ?? null;
  const history = open ? debts.filter(d => personKey(d.person) === open.key).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)) : [];

  return (
    <section aria-labelledby="people-title" className="space-y-4">
      <h1 id="people-title" className="text-lg font-bold">{t.people.title}</h1>
      <div className="grid grid-cols-2 gap-3">
        <div className={`${card} p-4`}><p className="text-sm text-muted">{t.people.owedToYou}</p><p className="num mt-0.5 text-2xl font-bold text-accent" data-testid="owed-to-you">{rupees(owedToYou(bs))}</p></div>
        <div className={`${card} p-4`}><p className="text-sm text-muted">{t.people.youOwe}</p><p className="num mt-0.5 text-2xl font-bold" data-testid="you-owe">{rupees(youOwe(bs))}</p></div>
      </div>

      {bs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-6 text-center">
          <p className="font-medium">{t.people.empty}</p>
          <p className="mt-1 text-sm text-muted">{t.people.emptyHint}</p>
        </div>
      ) : (
        <ul className={`divide-y divide-line overflow-hidden ${card}`} data-testid="people">
          {bs.map(b => (
            <li key={b.key}>
              <button type="button" onClick={() => setOpenKey(b.key)} className="press flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-soft/60">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-soft font-semibold" aria-hidden>{b.name.charAt(0).toUpperCase()}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{b.name}</span>
                  <span className={`num block text-[13px] ${b.paise > 0 ? "text-accent" : b.paise < 0 ? "text-bad" : "text-muted"}`}>
                    {b.paise > 0 ? t.people.oweYou(b.name, b.paise) : b.paise < 0 ? t.people.youOweP(b.name, -b.paise) : t.people.settled}
                    {b.paise !== 0 && <span className="text-muted"> · {t.people.for(daysBetween(b.since, now))}</span>}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <AddForm now={now} onAdd={onAdd} />
      {bs.some(b => b.paise > 0) && <UpiField value={upiId} onSave={onUpi} />}

      <Sheet open={!!open} onClose={() => setOpenKey(null)} label={open?.name ?? ""}>
        {open && (
          <div>
            <SheetHead title={open.name} onClose={() => setOpenKey(null)} />
            <p className={`num text-lg font-semibold ${open.paise > 0 ? "text-accent" : open.paise < 0 ? "text-bad" : "text-muted"}`} data-testid="person-balance">
              {open.paise > 0 ? t.people.oweYou(open.name, open.paise) : open.paise < 0 ? t.people.youOweP(open.name, -open.paise) : t.people.settled}
            </p>
            {open.paise > 0 && (
              <a href={whatsappLink(reminderText(open, i, upiId))} target="_blank" rel="noopener noreferrer" className={`${btnLine} mt-3 flex w-full items-center justify-center`} data-testid="remind-whatsapp">
                {t.people.remind}
              </a>
            )}
            {open.paise !== 0 && (
              <button type="button" className={`${btnPrimary} mt-3 w-full`}
                onClick={() => void onAdd({ person: open.name, dir: open.paise > 0 ? "got" : "gave", amountPaise: Math.abs(open.paise), note: t.people.settle, date: now })}>
                {t.people.settle} · {rupees(Math.abs(open.paise))}
              </button>
            )}
            <h3 className="mt-4 mb-1 text-sm font-semibold text-muted">{t.people.history}</h3>
            <ul className="divide-y divide-line">
              {history.map(d => (
                <li key={d.id} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px]">{d.dir === "gave" ? t.people.gaveRow : t.people.gotRow} <strong className="num">{rupees(d.amountPaise)}</strong></span>
                    <span className="block truncate text-[13px] text-muted">{[dateText(d.date, i), d.note].filter(Boolean).join(" · ")}</span>
                  </span>
                  <button type="button" onClick={() => void onDelete(d)} className="press min-h-11 shrink-0 rounded-xl px-3 text-[14px] font-semibold text-bad">{t.delete}</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Sheet>
    </section>
  );
}

function AddForm({ now, onAdd }: { now: string; onAdd: (d: { person: string; dir: Direction; amountPaise: number; note: string; date: string }) => Promise<void> }) {
  const { t } = useI18n();
  const [person, setPerson] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [dir, setDir] = useState<Direction>("gave");
  const [error, setError] = useState<{ field: "person" | "amount"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!person.trim()) { setError({ field: "person", text: t.err.noPerson }); document.getElementById("p-name")?.focus(); return; }
    const a = readRupees(amount);
    if (!a.ok) { setError({ field: "amount", text: t.err[a.code] }); document.getElementById("p-amount")?.focus(); return; }
    await onAdd({ person: person.trim().replace(/\s+/g, " ").slice(0, 40), dir, amountPaise: a.paise, note: note.trim().slice(0, 60), date: now });
    setPerson(""); setAmount(""); setNote(""); setError(null);
  }

  return (
    <form onSubmit={submit} noValidate className={`${card} p-4`} aria-labelledby="p-add">
      <h2 id="p-add" className="font-semibold">{t.people.add}</h2>
      <fieldset className="mt-3">
        <legend className="sr-only">{t.people.add}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["gave", "got"] as const).map(d => (
            <label key={d} className="press flex min-h-14 cursor-pointer flex-col items-center justify-center rounded-xl border border-line px-2 text-center has-checked:border-accent has-checked:bg-accent-soft has-focus-visible:outline-2 has-focus-visible:outline-accent">
              <input type="radio" name="dir" checked={dir === d} onChange={() => setDir(d)} className="sr-only" />
              <span className="text-[15px] font-semibold">{d === "gave" ? t.people.gave : t.people.got}</span>
              <span className="text-[12px] text-muted">{d === "gave" ? t.people.gaveHint : t.people.gotHint}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-3 grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-3">
        <div>
          <label htmlFor="p-name" className="mb-1 block text-sm font-medium">{t.people.person}</label>
          <input id="p-name" value={person} onChange={e => { setPerson(e.target.value); setError(null); }} autoComplete="off" maxLength={40}
            aria-invalid={error?.field === "person" || undefined} className="field" />
        </div>
        <div>
          <label htmlFor="p-amount" className="mb-1 block text-sm font-medium">{t.people.amount}</label>
          <input id="p-amount" value={amount} onChange={e => { setAmount(e.target.value); setError(null); }} inputMode="decimal" autoComplete="off"
            aria-invalid={error?.field === "amount" || undefined} className="field num" />
        </div>
      </div>
      {error && <p role="alert" className="mt-2 text-sm font-medium text-bad">{error.text}</p>}
      <label htmlFor="p-note" className="mt-3 mb-1 block text-sm font-medium">{t.people.note}</label>
      <input id="p-note" value={note} onChange={e => setNote(e.target.value)} maxLength={60} autoComplete="off" className="field" />
      <button type="submit" className={`${btnPrimary} mt-3 w-full`}>{t.people.save}</button>
    </form>
  );
}

function UpiField({ value, onSave }: { value: string | null; onSave: (v: string | null) => Promise<void> }) {
  const { t } = useI18n();
  const [v, setV] = useState(value ?? "");
  const [err, setErr] = useState<string | null>(null);
  return (
    <form className={`${card} p-4`} noValidate onSubmit={async e => {
      e.preventDefault();
      const x = v.trim();
      if (x && !UPI_ID.test(x)) { setErr(t.people.upiBad); return; }
      setErr(null); await onSave(x || null);
    }}>
      <label htmlFor="upi-id" className="mb-1 block text-sm font-medium">{t.people.upi}</label>
      <div className="flex gap-2">
        <input id="upi-id" value={v} onChange={e => { setV(e.target.value); setErr(null); }} placeholder={t.people.upiHint} autoComplete="off" autoCapitalize="none" spellCheck={false}
          aria-invalid={!!err || undefined} className="field min-w-0 flex-1" />
        <button type="submit" className={btnLine} data-testid="upi-save">{t.save}</button>
      </div>
      {err && <p role="alert" className="mt-1 text-sm text-bad">{err}</p>}
    </form>
  );
}
