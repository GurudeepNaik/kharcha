// Spends belong to the local calendar day they happened on, stored as "YYYY-MM-DD".

const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => ymd(new Date());
export const monthOf = (date: string) => date.slice(0, 7);

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return ymd(new Date(y, m - 1, d + n));
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** A real calendar date (rejects 31/02). */
export function validDate(y: number, m: number, d: number): string | null {
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? ymd(dt) : null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "Today", "Yesterday", or "Mon 10 Nov" (with the year when it isn't this year). */
export function dayLabel(date: string, now = today()): string {
  if (date === now) return "Today";
  if (date === addDays(now, -1)) return "Yesterday";
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const wd = new Date(y, m - 1, d).toLocaleDateString("en-IN", { weekday: "short" });
  return `${wd} ${d} ${MONTHS[m - 1]}${String(y) === now.slice(0, 4) ? "" : ` ${y}`}`;
}

export const shortDate = (date: string) => {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return `${d} ${MONTHS[m - 1]} ${y}`;
};

export const monthLabel = (month: string) => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return `${FULL[m - 1]} ${y}`;
};

/** Days in the month and how many are left including today (for "₹X left, Y days to go"). */
export function daysLeft(month: string, now = today()): number {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const last = new Date(y, m, 0).getDate();
  if (monthOf(now) !== month) return 0;
  return last - Number(now.slice(8)) + 1;
}
