// Money is kept as whole paise (integers) everywhere, so totals never pick up floating-point errors.

export const MAX_PAISE = 1_00_00_000_00; // ₹1 crore per spend

/** "₹1,25,000" or "₹99.50": Indian digit grouping, paise only when there are some. */
export function rupees(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(paise);
  const whole = Math.floor(abs / 100).toLocaleString("en-IN");
  const p = abs % 100;
  return `${sign}₹${whole}${p ? `.${String(p).padStart(2, "0")}` : ""}`;
}

/** Plain number for spreadsheets: 99.5 → "99.50", 20 → "20". */
export const plainAmount = (paise: number) => (paise % 100 ? (paise / 100).toFixed(2) : String(paise / 100));

/** An amount typed in a plain amount box ("1,250", "99.5") as paise, or why it can't be used. */
export function readRupees(raw: string): { ok: true; paise: number } | { ok: false; code: "noAmount" | "numbersOnly" | "zero" | "tooBig"; error: string } {
  const t = raw.replace(/[₹,\s]/g, "").replace(/^rs\.?/i, "");
  if (!t) return { ok: false, code: "noAmount", error: "Enter the amount." };
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return { ok: false, code: "numbersOnly", error: "Use numbers only, with at most 2 decimal places." };
  const paise = Math.round(Number(t) * 100);
  if (paise <= 0) return { ok: false, code: "zero", error: "The amount must be more than ₹0." };
  if (paise > MAX_PAISE) return { ok: false, code: "tooBig", error: "That's more than ₹1 crore. Check the amount." };
  return { ok: true, paise };
}
