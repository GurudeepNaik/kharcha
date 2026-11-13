"use client";

// Shown instead of the whole app while it's locked: PIN pad, fingerprint button, and the way out if the PIN is forgotten.
import { useCallback, useEffect, useRef, useState } from "react";
import { APP_NAME } from "@/lib/brand";
import { useI18n } from "@/lib/i18n";
import { bioCheck, checkPin, type LockData } from "@/lib/lock";
import { btnLine, card } from "./ui";

export function LockScreen({ lock, onSave, onUnlock, onErase }: {
  lock: LockData; onSave: (l: LockData) => Promise<void>; onUnlock: () => void; onErase: () => Promise<void>;
}) {
  const { t } = useI18n();
  const L = t.lock;
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState<0 | 1 | 2>(0);
  const tried = useRef(false);

  const bio = useCallback(async () => { if (lock.credId && await bioCheck(lock.credId)) onUnlock(); }, [lock.credId, onUnlock]);
  // Fingerprint straight away when it's on (some phones need a tap first; the button covers that).
  useEffect(() => { if (lock.credId && !tried.current) { tried.current = true; void bio(); } }, [lock.credId, bio]);

  async function submit(p: string) {
    setBusy(true);
    try {
      const r = await checkPin(lock, p);
      if (r.next !== lock) await onSave(r.next);
      if (r.ok) { onUnlock(); return; }
      setPin("");
      setMsg(r.waitSec ? L.wait(r.waitSec) : L.wrong);
    } finally { setBusy(false); }
  }
  function press(d: string) {
    if (busy) return;
    setMsg(null);
    const next = (pin + d).slice(0, lock.len);
    setPin(next);
    if (next.length === lock.len) void submit(next);
  }
  // A keyboard works too.
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (/^\d$/.test(e.key)) press(e.key); else if (e.key === "Backspace") setPin(p => p.slice(0, -1)); };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  });

  const key = "press grid h-16 place-items-center rounded-2xl bg-card text-2xl font-semibold border border-line disabled:opacity-50";
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-6 py-[max(1.5rem,env(safe-area-inset-top))]" data-testid="lock">
      <svg viewBox="0 0 512 512" width="56" height="56" aria-hidden>
        <rect width="512" height="512" rx="112" fill="var(--accent)" />
        <path d="M168 150h176M168 226h176M168 150c92 0 92 152 0 152l150 92" fill="none" stroke="var(--accent-fg)" strokeWidth="40" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <h1 className="mt-3 text-lg font-bold">{APP_NAME}</h1>
      {forgot ? (
        <div className={`${card} mt-6 w-full p-4`}>
          <p className="text-[15px]">{L.forgotText}</p>
          {forgot === 1
            ? <button type="button" onClick={() => setForgot(2)} className={`${btnLine} mt-4 w-full text-bad`} data-testid="lock-erase">{L.erase}</button>
            : <button type="button" onClick={() => void onErase()} className="press mt-4 min-h-12 w-full rounded-xl bg-bad px-4 font-semibold text-white" data-testid="lock-erase-sure">{L.eraseSure}</button>}
          <button type="button" onClick={() => setForgot(0)} className={`${btnLine} mt-2 w-full`}>{L.back}</button>
        </div>
      ) : (
        <>
          <p className="mt-6 font-medium" id="lock-label">{L.enter}</p>
          <div className="mt-3 flex gap-3" role="img" aria-label={`${pin.length} / ${lock.len}`}>
            {Array.from({ length: lock.len }, (_, k) => <span key={k} className={`size-3.5 rounded-full border-2 border-fg ${k < pin.length ? "bg-fg" : ""}`} />)}
          </div>
          <p className="mt-3 min-h-6 text-sm font-medium text-bad" role="alert" data-testid="lock-msg">{msg}</p>
          <div className="mt-2 grid w-full grid-cols-3 gap-3" role="group" aria-labelledby="lock-label">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(d => <button key={d} type="button" disabled={busy} onClick={() => press(d)} className={key} aria-label={L.digit(d)} data-key={d}>{d}</button>)}
            {lock.credId
              ? <button type="button" onClick={() => void bio()} className={`${key} text-[13px] leading-tight`} data-testid="lock-bio">{L.useBio}</button>
              : <span />}
            <button type="button" disabled={busy} onClick={() => press("0")} className={key} aria-label={L.digit("0")} data-key="0">0</button>
            <button type="button" onClick={() => { setPin(p => p.slice(0, -1)); setMsg(null); }} className={key} aria-label={L.del}>⌫</button>
          </div>
          <button type="button" onClick={() => setForgot(1)} className="press mt-5 min-h-11 px-3 text-[14px] font-semibold text-accent">{L.forgot}</button>
        </>
      )}
    </main>
  );
}
