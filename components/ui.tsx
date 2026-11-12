"use client";

// Small shared pieces: the spend row, the toast, the bottom sheet and icons.
import { useEffect, useRef } from "react";
import { categoryLabel } from "@/lib/categories";
import { rupees } from "@/lib/money";
import type { Expense } from "@/lib/types";

export const methodLabel = (m: Expense["method"]) => (m === "upi" ? "UPI" : m === "cash" ? "Cash" : "");

export function SpendRow({ e, onOpen }: { e: Expense; onOpen: (e: Expense) => void }) {
  const sub = [categoryLabel(e.category), methodLabel(e.method)].filter(Boolean).join(" · ");
  return (
    <li>
      <button type="button" onClick={() => onOpen(e)} data-id={e.id}
        className="press flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-soft/60">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">{e.note || categoryLabel(e.category)}</span>
          <span className="block truncate text-[13px] text-muted">{sub}</span>
        </span>
        <span className="num shrink-0 text-[15px] font-semibold">{rupees(e.amountPaise)}</span>
      </button>
    </li>
  );
}

export interface ToastMsg { id: number; text: string; undo?: () => void }

export function Toast({ msg, onDone }: { msg: ToastMsg | null; onDone: () => void }) {
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(onDone, msg.undo ? 6000 : 3500);
    return () => clearTimeout(t);
  }, [msg, onDone]);
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4">
      {msg && (
        <div key={msg.id} className="toast-in pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl bg-fg py-2 ps-4 pe-2 text-[15px] text-bg shadow-lg">
          <span className="min-w-0 flex-1">{msg.text}</span>
          {msg.undo && (
            <button type="button" onClick={() => { msg.undo!(); onDone(); }}
              className="press min-h-11 shrink-0 rounded-xl px-3 font-semibold text-accent-soft underline-offset-2 hover:underline dark:text-accent-fg">
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** A native modal dialog shown as a bottom sheet on phones: focus is kept inside, Esc closes it. */
export function Sheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="sheet" aria-label={label} onClose={onClose}
      onClick={e => { if (e.target === ref.current) onClose(); }}>
      {open && <div className="px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>}
    </dialog>
  );
}

export function SheetHead({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-lg font-bold">{title}</h2>
      <button type="button" onClick={onClose} aria-label="Close" className="press grid size-11 place-items-center rounded-full bg-soft text-muted">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </div>
  );
}

export const Icon = {
  home: <path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z" />,
  month: <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M4 10h16M9 3v4M15 3v4M8 15h3M8 18h6" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
  left: <path d="M15 6l-6 6 6 6" />,
  right: <path d="M9 6l6 6-6 6" />,
};

export function Svg({ children, size = 22 }: { children: React.ReactNode; size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{children}</svg>;
}
