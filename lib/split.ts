// Splitting a bill you paid: "dinner 1200 split ravi asha" → your share is a spend, Ravi and Asha each owe you theirs.
// "cab 600 split 3 ways" → only your share is noted (the others paid you on the spot).

const STOP = new Set(["with", "between", "among", "and", "me", "equally", "ways", "way", "yesterday", "today", "upi", "cash", "gpay", "phonepe", "paytm", "bhim", "nagad", "the", "to", "by", "in"]);
const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
export const MAX_PEOPLE = 12;

export interface SplitWords { rest: string; people: string[]; ways: number }

/** Finds "split …" in a line. `rest` is the line without the names, for the normal reader (amount, note, date, UPI/cash). */
export function splitWords(text: string): SplitWords | null {
  const m = /(^|\s)split(\s+.*)?$/i.exec(text);
  if (!m) return null;
  const before = text.slice(0, m.index).trim();
  const tail = (m[2] ?? "").trim();
  const waysM = /\b(\d{1,2})\s*(ways?|people|log)\b|\bin\s+(\d{1,2})\b/i.exec(tail);
  const kept: string[] = [], people: string[] = [];
  const tailNoWays = waysM ? tail.replace(waysM[0], " ") : tail;
  for (const w of tailNoWays.split(/[\s,&+]+/).filter(Boolean)) {
    if (/^[a-zऀ-ൿ]{2,20}$/i.test(w) && !STOP.has(w.toLowerCase())) {
      const name = titleCase(w);
      if (!people.includes(name)) people.push(name);
    } else if (!STOP.has(w.toLowerCase()) || /^(yesterday|today|upi|cash|gpay|phonepe|paytm|bhim|nagad)$/i.test(w)) kept.push(w);
  }
  const ways = people.length ? people.length + 1 : waysM ? Number(waysM[1] ?? waysM[3]) : 0;
  if (ways < 2 || ways > MAX_PEOPLE + 1) return null;
  return { rest: [before, ...kept].join(" ").trim(), people: people.slice(0, MAX_PEOPLE), ways };
}

/** Equal shares in whole rupees when possible; you take the leftover paise so the shares add up to the bill. */
export function shares(totalPaise: number, ways: number): { yours: number; each: number } {
  const exact = Math.floor(totalPaise / ways);
  const each = exact >= 100 ? Math.floor(exact / 100) * 100 : exact;
  return { each, yours: totalPaise - each * (ways - 1) };
}
