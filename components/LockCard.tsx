"use client";

// Settings: turn the app lock on or off, change the PIN, add fingerprint or face.
import { useEffect, useState } from "react";
import { APP_NAME } from "@/lib/brand";
import { useI18n } from "@/lib/i18n";
import { bioAvailable, bioRegister, checkPin, makeLock, PIN_MAX, validPin, type LockData } from "@/lib/lock";
import type { Settings } from "@/lib/types";
import { btnLine, btnPrimary, card } from "./ui";

export function LockCard({ lock, onSettings, say }: { lock: LockData | null; onSettings: (s: Partial<Settings>) => Promise<void>; say: (s: string) => void }) {
  const { t } = useI18n();
  const L = t.lock;
  const [mode, setMode] = useState<null | "set" | "off">(null);
  const [a, setA] = useState(""), [b, setB] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [bioOk, setBioOk] = useState(false);
  useEffect(() => { void bioAvailable().then(setBioOk); }, []);
  const reset = () => { setMode(null); setA(""); setB(""); setErr(null); };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!validPin(a)) { setErr(L.badPin); return; }
    if (a !== b) { setErr(L.noMatch); return; }
    await onSettings({ lock: await makeLock(a, lock?.credId ?? null) });
    reset(); say(L.turnedOn);
  }
  async function off(e: React.FormEvent) {
    e.preventDefault();
    if (!lock) return;
    const r = await checkPin(lock, a);
    if (!r.ok) { await onSettings({ lock: r.next }); setErr(r.waitSec ? L.wait(r.waitSec) : L.wrong); setA(""); return; }
    await onSettings({ lock: null });
    reset(); say(L.turnedOff);
  }
  async function bio(on: boolean) {
    if (!lock) return;
    if (!on) { await onSettings({ lock: { ...lock, credId: null } }); return; }
    const id = await bioRegister(APP_NAME);
    if (id) await onSettings({ lock: { ...lock, credId: id } }); else say(L.bioFail);
  }
  const pinInput = (id: string, label: string, v: string, set: (s: string) => void) => (
    <div className="mt-3">
      <label htmlFor={id} className="mb-1 block text-sm font-medium">{label}</label>
      <input id={id} type="password" inputMode="numeric" autoComplete="off" maxLength={PIN_MAX} value={v}
        onChange={e => { set(e.target.value.replace(/\D/g, "")); setErr(null); }} aria-invalid={!!err || undefined} className="field num tracking-[0.4em]" />
    </div>
  );

  return (
    <div className={`${card} p-4`} data-testid="lock-card">
      <h2 className="font-semibold">{L.title}{lock && <span className="ms-2 rounded-full bg-accent-soft px-2 py-0.5 text-[12px] font-semibold">{L.on}</span>}</h2>
      <p className="mt-0.5 text-sm text-muted">{L.help}</p>
      {mode === "set" ? (
        <form onSubmit={save} noValidate>
          {pinInput("lock-a", L.pin, a, setA)}
          {pinInput("lock-b", L.again, b, setB)}
          {err && <p role="alert" className="mt-2 text-sm font-medium text-bad">{err}</p>}
          <div className="mt-3 flex gap-2"><button type="button" onClick={reset} className={btnLine}>{L.cancel}</button><button type="submit" className={`${btnPrimary} flex-1`} data-testid="lock-save">{L.save}</button></div>
        </form>
      ) : mode === "off" ? (
        <form onSubmit={off} noValidate>
          {pinInput("lock-off", L.offAsk, a, setA)}
          {err && <p role="alert" className="mt-2 text-sm font-medium text-bad">{err}</p>}
          <div className="mt-3 flex gap-2"><button type="button" onClick={reset} className={btnLine}>{L.cancel}</button><button type="submit" className={`${btnPrimary} flex-1`} data-testid="lock-off-go">{L.off}</button></div>
        </form>
      ) : lock ? (
        <>
          {bioOk && (
            <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-2 text-[15px]">
              <input type="checkbox" checked={!!lock.credId} onChange={e => void bio(e.target.checked)} className="size-5 accent-[var(--accent)]" data-testid="lock-bio-toggle" />
              {L.bio}
            </label>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setMode("set")} className={btnLine} data-testid="lock-change">{L.change}</button>
            <button type="button" onClick={() => setMode("off")} className={btnLine} data-testid="lock-off">{L.off}</button>
          </div>
          <p className="mt-2 text-[13px] text-muted">{L.note}</p>
        </>
      ) : (
        <button type="button" onClick={() => setMode("set")} className={`${btnPrimary} mt-3`} data-testid="lock-set">{L.set}</button>
      )}
    </div>
  );
}
