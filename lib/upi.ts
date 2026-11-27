// Scan & pay: reads a shop's UPI QR code (upi://pay?pa=...&pn=...) and builds the link that opens the phone's UPI app
// with the amount filled in. The QR is untrusted input: only a upi://pay link is ever opened, rebuilt from known
// parameters, so a QR can't send the app anywhere else.
import { MAX_PAISE } from "./money";

export interface UpiPayee {
  /** The UPI ID being paid, like shop@ybl. */
  pa: string;
  /** The name in the QR, like "Sri Lakshmi Stores" (blank when the QR has none). */
  name: string;
  /** The amount fixed in the QR (shop billing QRs), or null when you type it. */
  amountPaise: number | null;
  /** The QR's own UPI parameters, kept for the payment link (merchant code, reference, note). */
  params: [string, string][];
}

const VPA = /^[a-z0-9._-]{2,256}@[a-z][a-z0-9.-]{1,64}$/i;
// Parameters a UPI app reads from the QR. Anything else is dropped.
const KEEP = new Set(["pa", "pn", "mc", "tid", "tr", "tn", "am", "mam", "cu", "url", "mode", "purpose", "orgid", "sign", "qrmedium", "invoiceno", "invoicedate", "gstin", "gstbrkup", "pinCode", "tier", "txnType", "QRexpire", "QRts", "category"].map(k => k.toLowerCase()));

/** Reads a scanned QR. Null when it isn't a UPI payment QR. */
export function readUpiQr(raw: string): UpiPayee | null {
  const s = raw.trim();
  const m = /^upi:\/\/pay\/?\?(.*)$/is.exec(s);
  if (!m) return null;
  let q: URLSearchParams;
  try { q = new URLSearchParams(m[1]!); } catch { return null; }
  const params: [string, string][] = [];
  for (const [k, v] of q) if (KEEP.has(k.toLowerCase()) && v.length <= 512 && !params.some(p => p[0].toLowerCase() === k.toLowerCase())) params.push([k, v]);
  const get = (k: string) => params.find(p => p[0].toLowerCase() === k)?.[1] ?? "";
  const pa = get("pa").trim();
  if (!VPA.test(pa)) return null;
  const name = get("pn").replace(/\s+/g, " ").trim().slice(0, 60);
  const am = get("am").trim();
  let amountPaise: number | null = null;
  if (/^\d{1,8}(\.\d{1,2})?$/.test(am)) {
    const p = Math.round(Number(am) * 100);
    if (p > 0 && p <= MAX_PAISE) amountPaise = p;
  }
  return { pa, name, amountPaise, params };
}

const amountText = (paise: number) => `${Math.floor(paise / 100)}.${String(paise % 100).padStart(2, "0")}`;

/** The upi://pay link for this payee and amount, with the QR's own parameters kept. */
export function payLink(p: UpiPayee, amountPaise: number): string {
  const out = new URLSearchParams();
  let hasCu = false;
  for (const [k, v] of p.params) {
    const lk = k.toLowerCase();
    if (lk === "am") continue;
    if (lk === "cu") hasCu = true;
    out.append(k, v);
  }
  out.set("am", amountText(amountPaise));
  if (!hasCu) out.set("cu", "INR");
  // UPI apps expect %20 for spaces (not +) and a plain @ in the UPI ID.
  return `upi://pay?${out.toString().replace(/\+/g, "%20").replace(/%40/g, "@")}`;
}

/** The note saved for the spend: the shop's name, else its UPI ID. */
export const payeeNote = (p: UpiPayee) => (p.name || p.pa).toLowerCase().replace(/\b\w/g, c => c.toUpperCase()).slice(0, 60);
