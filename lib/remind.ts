// Reminders before bills, EMIs, SIPs and insurance are due.
//  1. A calendar file (.ics): one repeating event per payment, with an alert the evening before and the morning of.
//     Works on any phone, even when the app is closed.
//  2. Phone notifications from the app: when it's opened, and in the background where the browser allows it
//     (installed app on Android Chrome). public/sw.js repeats the same check for the background case.
import { addMonths, addDays, monthOf } from "./dates";
import { anyTime, dayIn, dueIn, isMoneyIn, statusOf, type PlanItem } from "./plan";
import type { Expense } from "./types";

/** Things to pay today or tomorrow that aren't paid or skipped yet. Money in and pay-any-time items are left out. */
export function remindersDue(items: PlanItem[], rows: Expense[], now: string) {
  const out: { item: PlanItem; date: string; when: "today" | "tomorrow" }[] = [];
  const tomorrow = addDays(now, 1);
  for (const it of items) {
    if (isMoneyIn(it) || anyTime(it)) continue;
    for (const date of [now, tomorrow]) {
      const m = monthOf(date);
      if (!dueIn(it, m) || dayIn(m, it.day) !== date) continue;
      const st = statusOf(it, rows, m, now);
      if (st === "due" || st === "overdue") out.push({ item: it, date, when: date === now ? "today" : "tomorrow" });
    }
  }
  return out;
}

/** Key for "already told you about this one" so a reminder shows once. */
export const remindKey = (id: string, date: string) => `${id}:${date}`;

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
/** Lines longer than 75 bytes are folded, as calendar apps expect. */
function fold(line: string) {
  const out: string[] = [];
  let cur = "", bytes = 0;
  for (const ch of line) {
    const b = new TextEncoder().encode(ch).length;
    if (bytes + b > (out.length ? 74 : 75)) { out.push(cur); cur = ""; bytes = 0; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}

/** A calendar with one repeating all-day event per payment, from its next due month. */
export function calendarFile(items: PlanItem[], now: string, label: (it: PlanItem) => string, appUrl: string, stampIso = new Date().toISOString()) {
  const stamp = stampIso.replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Kharcha//Payments//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Kharcha payments"];
  let count = 0;
  for (const it of items) {
    if (isMoneyIn(it) || anyTime(it)) continue;
    let m = monthOf(now);
    for (let k = 0; k < 12 && !dueIn(it, m); k++) m = addMonths(m, 1);
    if (!dueIn(it, m)) continue;
    const start = dayIn(m, it.day).replace(/-/g, "");
    const end = addDays(dayIn(m, it.day), 1).replace(/-/g, "");
    const byDay = it.day >= 29 ? -1 : it.day; // 29–31: the last day, like the app does in short months
    count++;
    lines.push(
      "BEGIN:VEVENT", `UID:${it.id}@kharcha`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${start}`, `DTEND;VALUE=DATE:${end}`,
      `RRULE:FREQ=MONTHLY;INTERVAL=${it.every};BYMONTHDAY=${byDay}`, `SUMMARY:${esc(label(it))}`, `DESCRIPTION:${esc(`Mark it paid in Kharcha: ${appUrl}`)}`, "TRANSP:TRANSPARENT",
      "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(label(it))}`, "TRIGGER:-PT6H", "END:VALARM", // 6 PM the day before
      "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(label(it))}`, "TRIGGER:PT9H", "END:VALARM", // 9 AM on the day
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return { text: lines.map(fold).join("\r\n") + "\r\n", count };
}
