"use client";

// Screen text in English, Hindi and Kannada. Each language must have every key (TypeScript checks it),
// so a missing translation fails the build instead of showing a blank.
import { createContext, useContext } from "react";
import type { Category } from "./categories";
import { rupees as r } from "./money";

export type Lang = "en" | "hi" | "kn";
export const LANGS: { key: Lang; label: string; locale: string }[] = [
  { key: "en", label: "English", locale: "en-IN" },
  { key: "hi", label: "हिन्दी", locale: "hi-IN" },
  { key: "kn", label: "ಕನ್ನಡ", locale: "kn-IN" },
];
export const localeOf = (l: Lang) => LANGS.find(x => x.key === l)!.locale;

const en = {
  cat: { food: "Food", groceries: "Groceries", travel: "Travel", bills: "Bills", shopping: "Shopping", health: "Health", rent: "Rent & EMI", other: "Other", salary: "Salary", business: "Business", refund: "Refund", returns: "Investment returns", income: "Other income",
    sip: "SIP & mutual funds", stocks: "Stocks", deposit: "FD & RD", gold: "Gold", retirement: "PPF, NPS & EPF", termIns: "Term insurance", healthIns: "Health insurance", otherIns: "Other insurance", invest: "Other investment" } satisfies Record<Category, string>,
  upi: "UPI", cash: "Cash", notSet: "Not set",
  today: "Today", yesterday: "Yesterday",
  save: "Save", cancel: "Cancel", close: "Close", delete: "Delete", undo: "Undo", loading: "Loading…", everyMonth: "Every month",
  nav: { label: "Screens", home: "Home", month: "Month", people: "People", settings: "Settings" },
  storageBlocked: (app: string) => `This browser won't let ${app} save data. Private or incognito windows often block it; open the app in a normal window.`,
  install: { button: "Install", title: (app: string) => `Add ${app} to your Home Screen`, s1: "Tap the Share button at the bottom of Safari.", s2: "Choose Add to Home Screen.", s3: (app: string) => `Tap Add. ${app} opens like an app, even offline.`, ok: "Got it" },
  theme: (to: "light" | "dark"): string => (to === "dark" ? "Switch to dark mode" : "Switch to light mode"),
  home: {
    h1: (app: string) => `${app}: today and this month`,
    spentToday: "Spent today", spentMonth: "Spent this month", moneyIn: "Money in", invested: "Invested & insured", left: "Left this month", overspent: "Out more than came in",
    recent: "Recent", empty: "Nothing noted yet", emptyHint: "Type something like chai 20 or salary 50000 in the box below and tap Save.",
    daySpent: (x: number) => `${r(x)} spent`, older: "Show older entries",
    upcoming: "Coming up", upcomingHelp: "Added on its day. Skip one if you won't pay it this time.", skip: "Skip",
    backupNudge: "Back up your entries so you don't lose them.", backupBtn: "Back up",
    budgetNear: (cat: string, left: number, of: number) => `${cat}: ${r(left)} left of ${r(of)}`,
    budgetOver: (cat: string, over: number, of: number) => `${cat}: ${r(over)} over the ${r(of)} budget`,
  },
  search: {
    open: "Search and filter", placeholder: "Search: swiggy, 450, auto…", label: "Search entries",
    anyCat: "All categories", anyPay: "Any payment", kindAll: "In and out", kindOut: "Spent only", kindIn: "Money in only", kindInvest: "Invest & insure only", anyMonth: "Any month",
    clear: "Clear", results: (n: number, spent: number, inn: number) => `${n === 1 ? "1 entry" : `${n} entries`} · ${r(spent)} spent${inn ? ` · +${r(inn)} in` : ""}`,
    none: "Nothing matches. Try fewer words or clear the filters.",
  },
  add: {
    label: "Add a spend or money in", placeholder: "e.g. chai 20",
    hint: "Amount and what for, in any order. Add “yesterday” or 10/11, “upi” or “cash”. Start with + for money in, or “lent ravi 500”.",
    category: "Category", date: "Date", paidBy: "Paid by", spent: "Spent", in: "Money in", invest: "Invest & insure",
    gave: (p: string) => `You gave ${p}`, got: (p: string) => `${p} gave you`, toPeople: "Saved under People, not in spending",
  },
  err: {
    empty: "Type what you spent, like chai 20.", badDate: "That date doesn't exist. Write it as day/month, like 10/11.",
    futureDate: "That date is in the future. Entries can only be for today or earlier.", noAmount: "Add the amount, like chai 20.",
    decimals: "Use at most 2 decimal places (paise), like 99.50.", zero: "The amount must be more than ₹0.", tooBig: "That's more than ₹1 crore. Check the amount.",
    numbersOnly: "Use numbers only, with at most 2 decimal places.", pickDate: "Pick today or an earlier date.",
    debtNoAmount: "Add the amount, like lent ravi 500.", debtNoPerson: "Add who it was, like lent ravi 500.", noPerson: "Add the person's name.",
  },
  toast: {
    saved: (amt: string, cat: string, extra: string) => `Saved ${amt} · ${cat}${extra}`, monthly: " · every month",
    removed: "Removed", deleted: (what: string) => `Deleted ${what}`, changes: "Changes saved",
    repeatOn: "Saved. It will be added every month.", repeatOff: "Saved. It won't repeat any more.",
    added: (n: number, names: string) => `Added ${n === 1 ? "1 monthly entry" : `${n} monthly entries`}: ${names}`,
    stopped: (name: string) => `${name} won't be added any more`,
    skipped: (name: string, d: string) => `Skipped ${name} on ${d}. It comes back the month after.`, skippedThis: (name: string) => `Skipped ${name} this month. It comes back next month.`, restored: (a: number, u: number) => `Restored: ${a} added, ${u} updated`,
    limitSet: (x: number) => `Monthly limit set to ${r(x)}`, limitOff: "Monthly limit removed", budgets: "Budgets saved",
    shared: "Backup shared. Keep it somewhere safe, like Drive or WhatsApp to yourself.", shareFail: "Couldn't share the backup. Use Save backup file instead.",
    backupSaved: "Backup file saved to your downloads", csvSaved: "CSV saved to your downloads",
    debt: (text: string) => `Saved: ${text}`, settled: (p: string) => `Settled with ${p}`,
    overBudget: (cat: string, over: number) => `${cat} is ${r(over)} over budget this month`,
  },
  limit: {
    left: (x: number, of: number) => `${r(x)} left of ${r(of)}`, lastDay: "last day", days: (n: number) => `${n} days to go`,
    over: (x: number, of: number) => `${r(x)} over your ${r(of)} limit`,
  },
  edit: {
    title: "Change this entry", amount: "Amount (₹)", date: "Date", note: "What for", category: "Category", paidBy: "Paid by",
    everyHint: (day: number | string) => `Adds it again on day ${day} of each month, like rent or salary.`, save: "Save changes", skipThis: "Skip this month",
  },
  month: {
    prev: "Previous month", next: "Next month", spentIn: (m: string) => `Spent in ${m}`, count: (n: number) => (n === 1 ? "1 spend" : `${n} spends`),
    moneyIn: "Money in", saved: "Left over", overspent: "Overspent", allTime: "All time", thisMonth: "This month", none: (m: string) => `No spends noted in ${m}.`, byCat: "By category",
    more: (x: number, pct: number) => `${r(x)} more than last month by this day (+${pct}%)`,
    less: (x: number, pct: number) => `${r(x)} less than last month by this day (−${pct}%)`,
    moreFull: (x: number, pct: number) => `${r(x)} more than the month before (+${pct}%)`,
    lessFull: (x: number, pct: number) => `${r(x)} less than the month before (−${pct}%)`,
    same: "Same as last month by this day",
    daily: "Spent each day", six: "Last 6 months", table: "Show as a table", hideTable: "Hide table",
    day: "Day", monthCol: "Month", spentCol: "Spent", ofBudget: (x: number) => `of ${r(x)}`,
    tip: (label: string, x: number) => `${label}: ${r(x)}`,
  },
  receipt: {
    reading: "Reading the receipt…", first: "The first time takes longer: the receipt reader downloads once, then works offline.",
    done: "Read from the receipt. Check the amount and name, then tap Save.", failed: "Couldn't read the amount. Type it in the box below.",
    lost: "Couldn't get what was shared. Open the app once, then share again.", close: "Close receipt", alt: "The shared receipt",
  },
  people: {
    title: "People", owedToYou: "Others owe you", youOwe: "You owe", empty: "No one yet",
    emptyHint: "Note money you lend or borrow, like lent ravi 500 in the Home box, or use the form below.",
    oweYou: (p: string, x: number) => `${p} owes you ${r(x)}`, youOweP: (p: string, x: number) => `You owe ${p} ${r(x)}`, settled: "Settled",
    add: "Add money given or received", person: "Name", amount: "Amount (₹)", note: "Note (optional)",
    gave: "I gave", got: "I got", gaveHint: "Lent, or paid them back", gotHint: "Borrowed, or they paid you back",
    settle: "Settle up", history: "History", gaveRow: "You gave", gotRow: "You got", save: "Save",
  },
  settings: {
    title: "Settings", language: "Language",
    limit: "Monthly limit", limitHelp: "Home shows how much is left this month. Leave empty for no limit.", limitPh: "e.g. 20000",
    budgets: "Budget per category", budgetsHelp: "Optional. Home warns you when a category is close to its budget.", budgetsSave: "Save budgets",
    every: "Every month", everyEmpty: "Nothing repeats yet. Tap “Every month” when you add rent, salary or a subscription, and it's added for you each month.",
    next: (d: string) => `Next: ${d}`, stop: "Stop", skip: "Skip next",
    backup: "Back up", backupHelp: "Your entries are saved only in this browser on this phone. Save a backup now and then, so you can get them back on a new phone or if the browser's data is cleared.",
    lastBackup: (d: string) => ` Last backup: ${d}.`, noBackup: " No backup yet.",
    share: "Share backup", saveFile: "Save backup file", restore: "Restore from a backup",
    persisted: "This browser has agreed to keep your data, even when the phone is low on space.", notPersisted: "This browser may clear saved data when the phone is low on space. Backups keep you safe.",
    export: "Export for Excel", exportHelp: "Every entry, money in, spent and lending, as a CSV file that opens in Excel or Google Sheets.",
    exportN: (n: number) => `Export ${n === 1 ? "1 entry" : `${n} entries`}`,
    restoreQ: "Restore this backup?", restoreFrom: (d: string, n: number) => `Backup from ${d}, ${n === 1 ? "1 entry" : `${n} entries`}.`,
    restoreHas: (n: number) => `This backup has ${n === 1 ? "1 entry" : `${n} entries`}.`,
    rNew: "new, will be added", rChanged: "changed since, will be updated", rSame: "already here, left as they are",
    rNoDelete: "Nothing on this phone is deleted.", rBtn: "Restore", rNothing: "Nothing to restore",
    tooBig: "This file is too big to be a backup.", badFile: "This file isn't a backup from this app, or it is damaged.",
    newer: "This backup is from a newer version of the app. Reload the app and try again.",
  },
};
export type Msg = typeof en;

// Hindi and Kannada: plain, everyday words (written for people new to such apps). Native-speaker review is pending.
const hi: Msg = {
  cat: { food: "खाना", groceries: "किराना", travel: "आना-जाना", bills: "बिल", shopping: "खरीदारी", health: "सेहत", rent: "किराया और EMI", other: "अन्य", salary: "वेतन", business: "कारोबार", refund: "रिफंड", returns: "निवेश से आमदनी", income: "अन्य आमदनी",
    sip: "SIP और म्यूचुअल फंड", stocks: "शेयर", deposit: "FD और RD", gold: "सोना", retirement: "PPF, NPS और EPF", termIns: "टर्म बीमा", healthIns: "स्वास्थ्य बीमा", otherIns: "अन्य बीमा", invest: "अन्य निवेश" },
  upi: "UPI", cash: "नकद", notSet: "नहीं चुना",
  today: "आज", yesterday: "कल",
  save: "सेव करें", cancel: "रद्द करें", close: "बंद करें", delete: "हटाएँ", undo: "वापस लें", loading: "लोड हो रहा है…", everyMonth: "हर महीने",
  nav: { label: "स्क्रीन", home: "होम", month: "महीना", people: "लोग", settings: "सेटिंग्स" },
  storageBlocked: app => `यह ब्राउज़र ${app} को डेटा सेव नहीं करने दे रहा। प्राइवेट या इनकॉग्निटो विंडो में ऐसा होता है; ऐप को सामान्य विंडो में खोलें।`,
  install: { button: "इंस्टॉल", title: app => `${app} को होम स्क्रीन पर जोड़ें`, s1: "Safari में नीचे Share बटन दबाएँ।", s2: "Add to Home Screen चुनें।", s3: app => `Add दबाएँ। ${app} ऐप की तरह खुलेगा, इंटरनेट के बिना भी।`, ok: "ठीक है" },
  theme: to => (to === "dark" ? "डार्क मोड करें" : "लाइट मोड करें"),
  home: {
    h1: app => `${app}: आज और इस महीने`,
    spentToday: "आज का खर्च", spentMonth: "इस महीने का खर्च", moneyIn: "आमदनी", invested: "निवेश और बीमा", left: "इस महीने बचा", overspent: "आमदनी से ज़्यादा गया",
    recent: "हाल के", empty: "अभी कुछ नहीं लिखा", emptyHint: "नीचे के बॉक्स में chai 20 या salary 50000 जैसा लिखें और सेव करें।",
    daySpent: x => `${r(x)} खर्च`, older: "पुराने दिखाएँ",
    upcoming: "आने वाले", upcomingHelp: "अपने दिन अपने आप जुड़ेगा। इस बार नहीं भरना हो तो छोड़ें।", skip: "छोड़ें",
    backupNudge: "अपनी एंट्री का बैकअप लें ताकि वे खो न जाएँ।", backupBtn: "बैकअप",
    budgetNear: (cat, left, of) => `${cat}: ${r(of)} में से ${r(left)} बचा`,
    budgetOver: (cat, over, of) => `${cat}: ${r(of)} के बजट से ${r(over)} ज़्यादा`,
  },
  search: {
    open: "खोजें और छाँटें", placeholder: "खोजें: swiggy, 450, auto…", label: "एंट्री खोजें",
    anyCat: "सभी श्रेणियाँ", anyPay: "कोई भी भुगतान", kindAll: "आमदनी और खर्च", kindOut: "सिर्फ़ खर्च", kindIn: "सिर्फ़ आमदनी", kindInvest: "सिर्फ़ निवेश और बीमा", anyMonth: "कोई भी महीना",
    clear: "साफ़ करें", results: (n, spent, inn) => `${n} एंट्री · ${r(spent)} खर्च${inn ? ` · +${r(inn)} आमदनी` : ""}`,
    none: "कुछ नहीं मिला। कम शब्द लिखें या फ़िल्टर हटाएँ।",
  },
  add: {
    label: "खर्च या आमदनी जोड़ें", placeholder: "जैसे chai 20",
    hint: "रकम और किस पर, किसी भी क्रम में। “kal” या 10/11, “upi” या “cash” भी लिख सकते हैं। आमदनी के लिए आगे + लगाएँ, या “lent ravi 500”।",
    category: "श्रेणी", date: "तारीख", paidBy: "भुगतान", spent: "खर्च", in: "आमदनी", invest: "निवेश और बीमा",
    gave: p => `आपने ${p} को दिए`, got: p => `${p} ने आपको दिए`, toPeople: "‘लोग’ में सेव होगा, खर्च में नहीं",
  },
  err: {
    empty: "क्या खर्च किया लिखें, जैसे chai 20।", badDate: "यह तारीख नहीं होती। दिन/महीना लिखें, जैसे 10/11।",
    futureDate: "यह तारीख आगे की है। सिर्फ़ आज या पहले की एंट्री हो सकती है।", noAmount: "रकम लिखें, जैसे chai 20।",
    decimals: "दशमलव के बाद ज़्यादा से ज़्यादा 2 अंक (पैसे), जैसे 99.50।", zero: "रकम ₹0 से ज़्यादा होनी चाहिए।", tooBig: "यह ₹1 करोड़ से ज़्यादा है। रकम जाँचें।",
    numbersOnly: "सिर्फ़ अंक लिखें, दशमलव के बाद ज़्यादा से ज़्यादा 2।", pickDate: "आज या पहले की तारीख चुनें।",
    debtNoAmount: "रकम लिखें, जैसे lent ravi 500।", debtNoPerson: "किसको लिखें, जैसे lent ravi 500।", noPerson: "व्यक्ति का नाम लिखें।",
  },
  toast: {
    saved: (amt, cat, extra) => `सेव हुआ ${amt} · ${cat}${extra}`, monthly: " · हर महीने",
    removed: "हटा दिया", deleted: what => `हटाया: ${what}`, changes: "बदलाव सेव हुए",
    repeatOn: "सेव हुआ। यह हर महीने जुड़ेगा।", repeatOff: "सेव हुआ। अब यह दोहराया नहीं जाएगा।",
    added: (n, names) => `${n} मासिक एंट्री जोड़ी गईं: ${names}`,
    stopped: name => `${name} अब नहीं जुड़ेगा`,
    skipped: (name, d) => `${d} का ${name} छोड़ा। अगले महीने से फिर जुड़ेगा।`, skippedThis: name => `इस महीने का ${name} छोड़ा। अगले महीने फिर जुड़ेगा।`, restored: (a, u) => `वापस लाए: ${a} नए, ${u} बदले`,
    limitSet: x => `मासिक सीमा ${r(x)} रखी गई`, limitOff: "मासिक सीमा हटा दी", budgets: "बजट सेव हुए",
    shared: "बैकअप शेयर हुआ। इसे Drive या WhatsApp पर खुद को भेजकर सुरक्षित रखें।", shareFail: "बैकअप शेयर नहीं हुआ। ‘बैकअप फ़ाइल सेव करें’ आज़माएँ।",
    backupSaved: "बैकअप फ़ाइल डाउनलोड में सेव हुई", csvSaved: "CSV डाउनलोड में सेव हुई",
    debt: text => `सेव हुआ: ${text}`, settled: p => `${p} से हिसाब बराबर`,
    overBudget: (cat, over) => `इस महीने ${cat} बजट से ${r(over)} ज़्यादा`,
  },
  limit: {
    left: (x, of) => `${r(of)} में से ${r(x)} बचा`, lastDay: "आख़िरी दिन", days: n => `${n} दिन बाकी`,
    over: (x, of) => `${r(of)} की सीमा से ${r(x)} ज़्यादा`,
  },
  edit: {
    title: "एंट्री बदलें", amount: "रकम (₹)", date: "तारीख", note: "किस पर", category: "श्रेणी", paidBy: "भुगतान",
    everyHint: day => `हर महीने ${day} तारीख को फिर जुड़ेगा, जैसे किराया या वेतन।`, save: "बदलाव सेव करें", skipThis: "इस महीने छोड़ें",
  },
  month: {
    prev: "पिछला महीना", next: "अगला महीना", spentIn: m => `${m} में खर्च`, count: n => `${n} खर्च`,
    moneyIn: "आमदनी", saved: "बचा", overspent: "ज़्यादा खर्च", allTime: "अब तक कुल", thisMonth: "इस महीने", none: m => `${m} में कोई खर्च नहीं लिखा।`, byCat: "श्रेणी के हिसाब से",
    more: (x, pct) => `पिछले महीने इसी दिन तक से ${r(x)} ज़्यादा (+${pct}%)`,
    less: (x, pct) => `पिछले महीने इसी दिन तक से ${r(x)} कम (−${pct}%)`,
    moreFull: (x, pct) => `पिछले महीने से ${r(x)} ज़्यादा (+${pct}%)`,
    lessFull: (x, pct) => `पिछले महीने से ${r(x)} कम (−${pct}%)`,
    same: "पिछले महीने इसी दिन तक जितना",
    daily: "हर दिन का खर्च", six: "पिछले 6 महीने", table: "तालिका में दिखाएँ", hideTable: "तालिका छिपाएँ",
    day: "दिन", monthCol: "महीना", spentCol: "खर्च", ofBudget: x => `${r(x)} में से`,
    tip: (label, x) => `${label}: ${r(x)}`,
  },
  receipt: {
    reading: "रसीद पढ़ी जा रही है…", first: "पहली बार थोड़ा समय लगेगा: रसीद पढ़ने वाला एक बार डाउनलोड होगा, फिर बिना इंटरनेट चलेगा।",
    done: "रसीद से पढ़ा गया। रकम और नाम जाँचें, फिर सेव करें।", failed: "रकम पढ़ी नहीं जा सकी। नीचे के बॉक्स में लिखें।",
    lost: "शेयर की गई चीज़ नहीं मिली। ऐप एक बार खोलें, फिर दोबारा शेयर करें।", close: "रसीद बंद करें", alt: "शेयर की गई रसीद",
  },
  people: {
    title: "लोग", owedToYou: "आपको लेने हैं", youOwe: "आपको देने हैं", empty: "अभी कोई नहीं",
    emptyHint: "उधार दिया या लिया पैसा लिखें, जैसे होम बॉक्स में lent ravi 500, या नीचे का फ़ॉर्म भरें।",
    oweYou: (p, x) => `${p} से ${r(x)} लेने हैं`, youOweP: (p, x) => `${p} को ${r(x)} देने हैं`, settled: "हिसाब बराबर",
    add: "दिया या मिला पैसा जोड़ें", person: "नाम", amount: "रकम (₹)", note: "नोट (ज़रूरी नहीं)",
    gave: "मैंने दिए", got: "मुझे मिले", gaveHint: "उधार दिया, या लौटाया", gotHint: "उधार लिया, या उन्होंने लौटाया",
    settle: "हिसाब बराबर करें", history: "इतिहास", gaveRow: "आपने दिए", gotRow: "आपको मिले", save: "सेव करें",
  },
  settings: {
    title: "सेटिंग्स", language: "भाषा",
    limit: "मासिक सीमा", limitHelp: "होम पर दिखेगा कि इस महीने कितना बचा है। सीमा नहीं चाहिए तो खाली छोड़ें।", limitPh: "जैसे 20000",
    budgets: "हर श्रेणी का बजट", budgetsHelp: "ज़रूरी नहीं। जब कोई श्रेणी बजट के पास पहुँचे, होम पर चेतावनी दिखेगी।", budgetsSave: "बजट सेव करें",
    every: "हर महीने", everyEmpty: "अभी कुछ नहीं दोहराया जा रहा। किराया, वेतन या सब्सक्रिप्शन जोड़ते समय “हर महीने” दबाएँ, यह हर महीने अपने आप जुड़ेगा।",
    next: d => `अगली बार: ${d}`, stop: "रोकें", skip: "अगली बार छोड़ें",
    backup: "बैकअप", backupHelp: "आपकी एंट्री सिर्फ़ इस फ़ोन के इस ब्राउज़र में सेव हैं। समय-समय पर बैकअप लें, ताकि नए फ़ोन पर या डेटा मिटने पर वापस ला सकें।",
    lastBackup: d => ` पिछला बैकअप: ${d}।`, noBackup: " अभी तक कोई बैकअप नहीं।",
    share: "बैकअप शेयर करें", saveFile: "बैकअप फ़ाइल सेव करें", restore: "बैकअप से वापस लाएँ",
    persisted: "इस ब्राउज़र ने आपका डेटा रखने की हामी दी है, फ़ोन में जगह कम हो तब भी।", notPersisted: "फ़ोन में जगह कम होने पर यह ब्राउज़र डेटा मिटा सकता है। बैकअप से आप सुरक्षित रहेंगे।",
    export: "Excel के लिए निकालें", exportHelp: "हर एंट्री, आमदनी, खर्च और उधार, CSV फ़ाइल में जो Excel या Google Sheets में खुलती है।",
    exportN: n => `${n} एंट्री निकालें`,
    restoreQ: "यह बैकअप वापस लाएँ?", restoreFrom: (d, n) => `${d} का बैकअप, ${n} एंट्री।`,
    restoreHas: n => `इस बैकअप में ${n} एंट्री हैं।`,
    rNew: "नई, जोड़ी जाएँगी", rChanged: "बाद में बदली गईं, अपडेट होंगी", rSame: "पहले से हैं, वैसी ही रहेंगी",
    rNoDelete: "इस फ़ोन से कुछ नहीं हटेगा।", rBtn: "वापस लाएँ", rNothing: "वापस लाने को कुछ नहीं",
    tooBig: "यह फ़ाइल बैकअप होने के लिए बहुत बड़ी है।", badFile: "यह इस ऐप का बैकअप नहीं है, या फ़ाइल खराब है।",
    newer: "यह बैकअप ऐप के नए संस्करण का है। ऐप दोबारा खोलकर फिर कोशिश करें।",
  },
};

const kn: Msg = {
  cat: { food: "ಊಟ-ತಿಂಡಿ", groceries: "ದಿನಸಿ", travel: "ಪ್ರಯಾಣ", bills: "ಬಿಲ್‌ಗಳು", shopping: "ಖರೀದಿ", health: "ಆರೋಗ್ಯ", rent: "ಬಾಡಿಗೆ ಮತ್ತು EMI", other: "ಇತರೆ", salary: "ಸಂಬಳ", business: "ವ್ಯಾಪಾರ", refund: "ರಿಫಂಡ್", returns: "ಹೂಡಿಕೆ ಆದಾಯ", income: "ಇತರೆ ಆದಾಯ",
    sip: "SIP ಮತ್ತು ಮ್ಯೂಚುವಲ್ ಫಂಡ್", stocks: "ಷೇರುಗಳು", deposit: "FD ಮತ್ತು RD", gold: "ಚಿನ್ನ", retirement: "PPF, NPS ಮತ್ತು EPF", termIns: "ಟರ್ಮ್ ವಿಮೆ", healthIns: "ಆರೋಗ್ಯ ವಿಮೆ", otherIns: "ಇತರೆ ವಿಮೆ", invest: "ಇತರೆ ಹೂಡಿಕೆ" },
  upi: "UPI", cash: "ನಗದು", notSet: "ಆಯ್ಕೆ ಇಲ್ಲ",
  today: "ಇಂದು", yesterday: "ನಿನ್ನೆ",
  save: "ಉಳಿಸಿ", cancel: "ರದ್ದು", close: "ಮುಚ್ಚಿ", delete: "ಅಳಿಸಿ", undo: "ಹಿಂಪಡೆ", loading: "ಲೋಡ್ ಆಗುತ್ತಿದೆ…", everyMonth: "ಪ್ರತಿ ತಿಂಗಳು",
  nav: { label: "ಪರದೆಗಳು", home: "ಮುಖಪುಟ", month: "ತಿಂಗಳು", people: "ಜನರು", settings: "ಸೆಟ್ಟಿಂಗ್ಸ್" },
  storageBlocked: app => `ಈ ಬ್ರೌಸರ್ ${app} ಗೆ ಡೇಟಾ ಉಳಿಸಲು ಬಿಡುತ್ತಿಲ್ಲ. ಪ್ರೈವೇಟ್ ಅಥವಾ ಇನ್ಕಾಗ್ನಿಟೋ ವಿಂಡೋದಲ್ಲಿ ಹೀಗಾಗುತ್ತದೆ; ಸಾಮಾನ್ಯ ವಿಂಡೋದಲ್ಲಿ ತೆರೆಯಿರಿ.`,
  install: { button: "ಇನ್‌ಸ್ಟಾಲ್", title: app => `${app} ಅನ್ನು ಹೋಮ್ ಸ್ಕ್ರೀನ್‌ಗೆ ಸೇರಿಸಿ`, s1: "Safari ಯ ಕೆಳಗಿನ Share ಬಟನ್ ಒತ್ತಿ.", s2: "Add to Home Screen ಆಯ್ಕೆಮಾಡಿ.", s3: app => `Add ಒತ್ತಿ. ${app} ಆಪ್‌ನಂತೆ ತೆರೆಯುತ್ತದೆ, ಇಂಟರ್ನೆಟ್ ಇಲ್ಲದೆಯೂ.`, ok: "ಸರಿ" },
  theme: to => (to === "dark" ? "ಡಾರ್ಕ್ ಮೋಡ್‌ಗೆ ಬದಲಿಸಿ" : "ಲೈಟ್ ಮೋಡ್‌ಗೆ ಬದಲಿಸಿ"),
  home: {
    h1: app => `${app}: ಇಂದು ಮತ್ತು ಈ ತಿಂಗಳು`,
    spentToday: "ಇಂದಿನ ಖರ್ಚು", spentMonth: "ಈ ತಿಂಗಳ ಖರ್ಚು", moneyIn: "ಆದಾಯ", invested: "ಹೂಡಿಕೆ ಮತ್ತು ವಿಮೆ", left: "ಈ ತಿಂಗಳು ಉಳಿದಿದೆ", overspent: "ಆದಾಯಕ್ಕಿಂತ ಹೆಚ್ಚು ಖರ್ಚು",
    recent: "ಇತ್ತೀಚಿನವು", empty: "ಇನ್ನೂ ಏನೂ ಬರೆದಿಲ್ಲ", emptyHint: "ಕೆಳಗಿನ ಬಾಕ್ಸ್‌ನಲ್ಲಿ chai 20 ಅಥವಾ salary 50000 ಎಂದು ಬರೆದು ಉಳಿಸಿ.",
    daySpent: x => `${r(x)} ಖರ್ಚು`, older: "ಹಳೆಯವನ್ನು ತೋರಿಸಿ",
    upcoming: "ಮುಂಬರುವವು", upcomingHelp: "ಅದರ ದಿನ ತಾನಾಗಿ ಸೇರುತ್ತದೆ. ಈ ಬಾರಿ ಪಾವತಿಸದಿದ್ದರೆ ಬಿಡಿ.", skip: "ಬಿಡಿ",
    backupNudge: "ನಿಮ್ಮ ನಮೂದುಗಳು ಕಳೆದುಹೋಗದಂತೆ ಬ್ಯಾಕಪ್ ಮಾಡಿ.", backupBtn: "ಬ್ಯಾಕಪ್",
    budgetNear: (cat, left, of) => `${cat}: ${r(of)} ರಲ್ಲಿ ${r(left)} ಉಳಿದಿದೆ`,
    budgetOver: (cat, over, of) => `${cat}: ${r(of)} ಬಜೆಟ್‌ಗಿಂತ ${r(over)} ಹೆಚ್ಚು`,
  },
  search: {
    open: "ಹುಡುಕಿ ಮತ್ತು ಫಿಲ್ಟರ್ ಮಾಡಿ", placeholder: "ಹುಡುಕಿ: swiggy, 450, auto…", label: "ನಮೂದುಗಳನ್ನು ಹುಡುಕಿ",
    anyCat: "ಎಲ್ಲಾ ವರ್ಗಗಳು", anyPay: "ಯಾವುದೇ ಪಾವತಿ", kindAll: "ಆದಾಯ ಮತ್ತು ಖರ್ಚು", kindOut: "ಖರ್ಚು ಮಾತ್ರ", kindIn: "ಆದಾಯ ಮಾತ್ರ", kindInvest: "ಹೂಡಿಕೆ ಮತ್ತು ವಿಮೆ ಮಾತ್ರ", anyMonth: "ಯಾವುದೇ ತಿಂಗಳು",
    clear: "ತೆರವುಗೊಳಿಸಿ", results: (n, spent, inn) => `${n} ನಮೂದು · ${r(spent)} ಖರ್ಚು${inn ? ` · +${r(inn)} ಆದಾಯ` : ""}`,
    none: "ಏನೂ ಸಿಗಲಿಲ್ಲ. ಕಡಿಮೆ ಪದಗಳನ್ನು ಬಳಸಿ ಅಥವಾ ಫಿಲ್ಟರ್ ತೆಗೆಯಿರಿ.",
  },
  add: {
    label: "ಖರ್ಚು ಅಥವಾ ಆದಾಯ ಸೇರಿಸಿ", placeholder: "ಉದಾ. chai 20",
    hint: "ಮೊತ್ತ ಮತ್ತು ಯಾವುದಕ್ಕೆ, ಯಾವ ಕ್ರಮದಲ್ಲಾದರೂ. “yesterday” ಅಥವಾ 10/11, “upi” ಅಥವಾ “cash” ಸೇರಿಸಬಹುದು. ಆದಾಯಕ್ಕೆ ಮುಂದೆ + ಹಾಕಿ, ಅಥವಾ “lent ravi 500”.",
    category: "ವರ್ಗ", date: "ದಿನಾಂಕ", paidBy: "ಪಾವತಿ", spent: "ಖರ್ಚು", in: "ಆದಾಯ", invest: "ಹೂಡಿಕೆ ಮತ್ತು ವಿಮೆ",
    gave: p => `ನೀವು ${p} ಗೆ ಕೊಟ್ಟಿದ್ದು`, got: p => `${p} ನಿಮಗೆ ಕೊಟ್ಟಿದ್ದು`, toPeople: "‘ಜನರು’ ಅಡಿಯಲ್ಲಿ ಉಳಿಸಲಾಗುತ್ತದೆ, ಖರ್ಚಿನಲ್ಲಿ ಅಲ್ಲ",
  },
  err: {
    empty: "ಏನು ಖರ್ಚು ಮಾಡಿದಿರಿ ಬರೆಯಿರಿ, ಉದಾ. chai 20.", badDate: "ಈ ದಿನಾಂಕ ಇಲ್ಲ. ದಿನ/ತಿಂಗಳು ಎಂದು ಬರೆಯಿರಿ, ಉದಾ. 10/11.",
    futureDate: "ಈ ದಿನಾಂಕ ಮುಂದಿನದು. ಇಂದಿನ ಅಥವಾ ಹಿಂದಿನ ನಮೂದುಗಳು ಮಾತ್ರ.", noAmount: "ಮೊತ್ತ ಬರೆಯಿರಿ, ಉದಾ. chai 20.",
    decimals: "ದಶಮಾಂಶದ ನಂತರ ಗರಿಷ್ಠ 2 ಅಂಕೆ (ಪೈಸೆ), ಉದಾ. 99.50.", zero: "ಮೊತ್ತ ₹0 ಗಿಂತ ಹೆಚ್ಚಿರಬೇಕು.", tooBig: "ಇದು ₹1 ಕೋಟಿಗಿಂತ ಹೆಚ್ಚು. ಮೊತ್ತ ಪರಿಶೀಲಿಸಿ.",
    numbersOnly: "ಅಂಕೆಗಳನ್ನು ಮಾತ್ರ ಬಳಸಿ, ದಶಮಾಂಶದ ನಂತರ ಗರಿಷ್ಠ 2.", pickDate: "ಇಂದಿನ ಅಥವಾ ಹಿಂದಿನ ದಿನಾಂಕ ಆಯ್ಕೆಮಾಡಿ.",
    debtNoAmount: "ಮೊತ್ತ ಬರೆಯಿರಿ, ಉದಾ. lent ravi 500.", debtNoPerson: "ಯಾರಿಗೆ ಎಂದು ಬರೆಯಿರಿ, ಉದಾ. lent ravi 500.", noPerson: "ವ್ಯಕ್ತಿಯ ಹೆಸರು ಬರೆಯಿರಿ.",
  },
  toast: {
    saved: (amt, cat, extra) => `ಉಳಿಸಲಾಗಿದೆ ${amt} · ${cat}${extra}`, monthly: " · ಪ್ರತಿ ತಿಂಗಳು",
    removed: "ತೆಗೆದುಹಾಕಲಾಗಿದೆ", deleted: what => `ಅಳಿಸಲಾಗಿದೆ: ${what}`, changes: "ಬದಲಾವಣೆಗಳನ್ನು ಉಳಿಸಲಾಗಿದೆ",
    repeatOn: "ಉಳಿಸಲಾಗಿದೆ. ಇದು ಪ್ರತಿ ತಿಂಗಳು ಸೇರುತ್ತದೆ.", repeatOff: "ಉಳಿಸಲಾಗಿದೆ. ಇನ್ನು ಇದು ಪುನರಾವರ್ತನೆ ಆಗುವುದಿಲ್ಲ.",
    added: (n, names) => `${n} ಮಾಸಿಕ ನಮೂದು ಸೇರಿಸಲಾಗಿದೆ: ${names}`,
    stopped: name => `${name} ಇನ್ನು ಸೇರುವುದಿಲ್ಲ`,
    skipped: (name, d) => `${d} ರ ${name} ಬಿಡಲಾಗಿದೆ. ಮುಂದಿನ ತಿಂಗಳಿಂದ ಮತ್ತೆ ಸೇರುತ್ತದೆ.`, skippedThis: name => `ಈ ತಿಂಗಳ ${name} ಬಿಡಲಾಗಿದೆ. ಮುಂದಿನ ತಿಂಗಳು ಮತ್ತೆ ಸೇರುತ್ತದೆ.`, restored: (a, u) => `ಹಿಂಪಡೆಯಲಾಗಿದೆ: ${a} ಹೊಸದು, ${u} ಬದಲಾದವು`,
    limitSet: x => `ಮಾಸಿಕ ಮಿತಿ ${r(x)}`, limitOff: "ಮಾಸಿಕ ಮಿತಿ ತೆಗೆಯಲಾಗಿದೆ", budgets: "ಬಜೆಟ್ ಉಳಿಸಲಾಗಿದೆ",
    shared: "ಬ್ಯಾಕಪ್ ಹಂಚಲಾಗಿದೆ. Drive ಅಥವಾ WhatsApp ನಲ್ಲಿ ನಿಮಗೇ ಕಳುಹಿಸಿ ಸುರಕ್ಷಿತವಾಗಿಡಿ.", shareFail: "ಬ್ಯಾಕಪ್ ಹಂಚಲಾಗಲಿಲ್ಲ. ‘ಬ್ಯಾಕಪ್ ಫೈಲ್ ಉಳಿಸಿ’ ಬಳಸಿ.",
    backupSaved: "ಬ್ಯಾಕಪ್ ಫೈಲ್ ಡೌನ್‌ಲೋಡ್‌ಗಳಲ್ಲಿ ಉಳಿಸಲಾಗಿದೆ", csvSaved: "CSV ಡೌನ್‌ಲೋಡ್‌ಗಳಲ್ಲಿ ಉಳಿಸಲಾಗಿದೆ",
    debt: text => `ಉಳಿಸಲಾಗಿದೆ: ${text}`, settled: p => `${p} ಜೊತೆ ಲೆಕ್ಕ ಚುಕ್ತಾ`,
    overBudget: (cat, over) => `ಈ ತಿಂಗಳು ${cat} ಬಜೆಟ್‌ಗಿಂತ ${r(over)} ಹೆಚ್ಚು`,
  },
  limit: {
    left: (x, of) => `${r(of)} ರಲ್ಲಿ ${r(x)} ಉಳಿದಿದೆ`, lastDay: "ಕೊನೆಯ ದಿನ", days: n => `ಇನ್ನೂ ${n} ದಿನ`,
    over: (x, of) => `${r(of)} ಮಿತಿಗಿಂತ ${r(x)} ಹೆಚ್ಚು`,
  },
  edit: {
    title: "ನಮೂದು ಬದಲಿಸಿ", amount: "ಮೊತ್ತ (₹)", date: "ದಿನಾಂಕ", note: "ಯಾವುದಕ್ಕೆ", category: "ವರ್ಗ", paidBy: "ಪಾವತಿ",
    everyHint: day => `ಪ್ರತಿ ತಿಂಗಳ ${day} ನೇ ದಿನ ಮತ್ತೆ ಸೇರುತ್ತದೆ, ಬಾಡಿಗೆ ಅಥವಾ ಸಂಬಳದಂತೆ.`, save: "ಬದಲಾವಣೆ ಉಳಿಸಿ", skipThis: "ಈ ತಿಂಗಳು ಬಿಡಿ",
  },
  month: {
    prev: "ಹಿಂದಿನ ತಿಂಗಳು", next: "ಮುಂದಿನ ತಿಂಗಳು", spentIn: m => `${m} ರಲ್ಲಿ ಖರ್ಚು`, count: n => `${n} ಖರ್ಚು`,
    moneyIn: "ಆದಾಯ", saved: "ಉಳಿದದ್ದು", overspent: "ಹೆಚ್ಚು ಖರ್ಚು", allTime: "ಇಲ್ಲಿಯವರೆಗೆ ಒಟ್ಟು", thisMonth: "ಈ ತಿಂಗಳು", none: m => `${m} ರಲ್ಲಿ ಯಾವುದೇ ಖರ್ಚು ಬರೆದಿಲ್ಲ.`, byCat: "ವರ್ಗವಾರು",
    more: (x, pct) => `ಹಿಂದಿನ ತಿಂಗಳ ಇದೇ ದಿನಕ್ಕಿಂತ ${r(x)} ಹೆಚ್ಚು (+${pct}%)`,
    less: (x, pct) => `ಹಿಂದಿನ ತಿಂಗಳ ಇದೇ ದಿನಕ್ಕಿಂತ ${r(x)} ಕಡಿಮೆ (−${pct}%)`,
    moreFull: (x, pct) => `ಹಿಂದಿನ ತಿಂಗಳಿಗಿಂತ ${r(x)} ಹೆಚ್ಚು (+${pct}%)`,
    lessFull: (x, pct) => `ಹಿಂದಿನ ತಿಂಗಳಿಗಿಂತ ${r(x)} ಕಡಿಮೆ (−${pct}%)`,
    same: "ಹಿಂದಿನ ತಿಂಗಳ ಇದೇ ದಿನದಷ್ಟೇ",
    daily: "ಪ್ರತಿದಿನದ ಖರ್ಚು", six: "ಕಳೆದ 6 ತಿಂಗಳು", table: "ಕೋಷ್ಟಕವಾಗಿ ತೋರಿಸಿ", hideTable: "ಕೋಷ್ಟಕ ಮರೆಮಾಡಿ",
    day: "ದಿನ", monthCol: "ತಿಂಗಳು", spentCol: "ಖರ್ಚು", ofBudget: x => `${r(x)} ರಲ್ಲಿ`,
    tip: (label, x) => `${label}: ${r(x)}`,
  },
  receipt: {
    reading: "ರಸೀದಿ ಓದಲಾಗುತ್ತಿದೆ…", first: "ಮೊದಲ ಬಾರಿ ಸ್ವಲ್ಪ ಸಮಯ ಬೇಕು: ರಸೀದಿ ಓದುವ ಸಾಧನ ಒಮ್ಮೆ ಡೌನ್‌ಲೋಡ್ ಆಗುತ್ತದೆ, ನಂತರ ಇಂಟರ್ನೆಟ್ ಇಲ್ಲದೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ.",
    done: "ರಸೀದಿಯಿಂದ ಓದಲಾಗಿದೆ. ಮೊತ್ತ ಮತ್ತು ಹೆಸರು ಪರಿಶೀಲಿಸಿ, ನಂತರ ಉಳಿಸಿ.", failed: "ಮೊತ್ತ ಓದಲಾಗಲಿಲ್ಲ. ಕೆಳಗಿನ ಬಾಕ್ಸ್‌ನಲ್ಲಿ ಬರೆಯಿರಿ.",
    lost: "ಹಂಚಿದ್ದು ಸಿಗಲಿಲ್ಲ. ಆಪ್ ಒಮ್ಮೆ ತೆರೆಯಿರಿ, ನಂತರ ಮತ್ತೆ ಹಂಚಿ.", close: "ರಸೀದಿ ಮುಚ್ಚಿ", alt: "ಹಂಚಿದ ರಸೀದಿ",
  },
  people: {
    title: "ಜನರು", owedToYou: "ನಿಮಗೆ ಬರಬೇಕಾದದ್ದು", youOwe: "ನೀವು ಕೊಡಬೇಕಾದದ್ದು", empty: "ಇನ್ನೂ ಯಾರೂ ಇಲ್ಲ",
    emptyHint: "ಸಾಲ ಕೊಟ್ಟ ಅಥವಾ ಪಡೆದ ಹಣ ಬರೆಯಿರಿ, ಉದಾ. ಮುಖಪುಟ ಬಾಕ್ಸ್‌ನಲ್ಲಿ lent ravi 500, ಅಥವಾ ಕೆಳಗಿನ ಫಾರ್ಮ್ ಬಳಸಿ.",
    oweYou: (p, x) => `${p} ನಿಮಗೆ ${r(x)} ಕೊಡಬೇಕು`, youOweP: (p, x) => `ನೀವು ${p} ಗೆ ${r(x)} ಕೊಡಬೇಕು`, settled: "ಲೆಕ್ಕ ಚುಕ್ತಾ",
    add: "ಕೊಟ್ಟ ಅಥವಾ ಪಡೆದ ಹಣ ಸೇರಿಸಿ", person: "ಹೆಸರು", amount: "ಮೊತ್ತ (₹)", note: "ಟಿಪ್ಪಣಿ (ಬೇಕಾದರೆ)",
    gave: "ನಾನು ಕೊಟ್ಟೆ", got: "ನನಗೆ ಬಂತು", gaveHint: "ಸಾಲ ಕೊಟ್ಟೆ, ಅಥವಾ ಹಿಂದಿರುಗಿಸಿದೆ", gotHint: "ಸಾಲ ಪಡೆದೆ, ಅಥವಾ ಅವರು ಹಿಂದಿರುಗಿಸಿದರು",
    settle: "ಲೆಕ್ಕ ಚುಕ್ತಾ ಮಾಡಿ", history: "ಇತಿಹಾಸ", gaveRow: "ನೀವು ಕೊಟ್ಟಿದ್ದು", gotRow: "ನಿಮಗೆ ಬಂದದ್ದು", save: "ಉಳಿಸಿ",
  },
  settings: {
    title: "ಸೆಟ್ಟಿಂಗ್ಸ್", language: "ಭಾಷೆ",
    limit: "ಮಾಸಿಕ ಮಿತಿ", limitHelp: "ಈ ತಿಂಗಳು ಎಷ್ಟು ಉಳಿದಿದೆ ಎಂದು ಮುಖಪುಟ ತೋರಿಸುತ್ತದೆ. ಮಿತಿ ಬೇಡವಾದರೆ ಖಾಲಿ ಬಿಡಿ.", limitPh: "ಉದಾ. 20000",
    budgets: "ವರ್ಗವಾರು ಬಜೆಟ್", budgetsHelp: "ಬೇಕಾದರೆ ಮಾತ್ರ. ಯಾವುದೇ ವರ್ಗ ಬಜೆಟ್ ಹತ್ತಿರ ಬಂದಾಗ ಮುಖಪುಟ ಎಚ್ಚರಿಸುತ್ತದೆ.", budgetsSave: "ಬಜೆಟ್ ಉಳಿಸಿ",
    every: "ಪ್ರತಿ ತಿಂಗಳು", everyEmpty: "ಇನ್ನೂ ಏನೂ ಪುನರಾವರ್ತನೆ ಆಗುತ್ತಿಲ್ಲ. ಬಾಡಿಗೆ, ಸಂಬಳ ಅಥವಾ ಚಂದಾದಾರಿಕೆ ಸೇರಿಸುವಾಗ “ಪ್ರತಿ ತಿಂಗಳು” ಒತ್ತಿ, ಅದು ಪ್ರತಿ ತಿಂಗಳು ತಾನಾಗಿ ಸೇರುತ್ತದೆ.",
    next: d => `ಮುಂದಿನದು: ${d}`, stop: "ನಿಲ್ಲಿಸಿ", skip: "ಮುಂದಿನದು ಬಿಡಿ",
    backup: "ಬ್ಯಾಕಪ್", backupHelp: "ನಿಮ್ಮ ನಮೂದುಗಳು ಈ ಫೋನಿನ ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಮಾತ್ರ ಇವೆ. ಆಗಾಗ ಬ್ಯಾಕಪ್ ಮಾಡಿ, ಹೊಸ ಫೋನಿನಲ್ಲಿ ಅಥವಾ ಡೇಟಾ ಅಳಿಸಿಹೋದರೆ ಹಿಂಪಡೆಯಬಹುದು.",
    lastBackup: d => ` ಕೊನೆಯ ಬ್ಯಾಕಪ್: ${d}.`, noBackup: " ಇನ್ನೂ ಬ್ಯಾಕಪ್ ಇಲ್ಲ.",
    share: "ಬ್ಯಾಕಪ್ ಹಂಚಿ", saveFile: "ಬ್ಯಾಕಪ್ ಫೈಲ್ ಉಳಿಸಿ", restore: "ಬ್ಯಾಕಪ್‌ನಿಂದ ಹಿಂಪಡೆಯಿರಿ",
    persisted: "ಫೋನಿನಲ್ಲಿ ಜಾಗ ಕಡಿಮೆಯಾದರೂ ನಿಮ್ಮ ಡೇಟಾ ಇಟ್ಟುಕೊಳ್ಳಲು ಈ ಬ್ರೌಸರ್ ಒಪ್ಪಿದೆ.", notPersisted: "ಫೋನಿನಲ್ಲಿ ಜಾಗ ಕಡಿಮೆಯಾದಾಗ ಈ ಬ್ರೌಸರ್ ಡೇಟಾ ಅಳಿಸಬಹುದು. ಬ್ಯಾಕಪ್ ನಿಮ್ಮನ್ನು ಸುರಕ್ಷಿತವಾಗಿಡುತ್ತದೆ.",
    export: "Excel ಗಾಗಿ ರಫ್ತು", exportHelp: "ಪ್ರತಿ ನಮೂದು, ಆದಾಯ, ಖರ್ಚು ಮತ್ತು ಸಾಲ, Excel ಅಥವಾ Google Sheets ನಲ್ಲಿ ತೆರೆಯುವ CSV ಫೈಲ್ ಆಗಿ.",
    exportN: n => `${n} ನಮೂದು ರಫ್ತು ಮಾಡಿ`,
    restoreQ: "ಈ ಬ್ಯಾಕಪ್ ಹಿಂಪಡೆಯಬೇಕೆ?", restoreFrom: (d, n) => `${d} ರ ಬ್ಯಾಕಪ್, ${n} ನಮೂದು.`,
    restoreHas: n => `ಈ ಬ್ಯಾಕಪ್‌ನಲ್ಲಿ ${n} ನಮೂದುಗಳಿವೆ.`,
    rNew: "ಹೊಸದು, ಸೇರಿಸಲಾಗುತ್ತದೆ", rChanged: "ನಂತರ ಬದಲಾದವು, ನವೀಕರಿಸಲಾಗುತ್ತದೆ", rSame: "ಈಗಾಗಲೇ ಇವೆ, ಹಾಗೆಯೇ ಇರುತ್ತವೆ",
    rNoDelete: "ಈ ಫೋನಿನಿಂದ ಏನೂ ಅಳಿಸುವುದಿಲ್ಲ.", rBtn: "ಹಿಂಪಡೆಯಿರಿ", rNothing: "ಹಿಂಪಡೆಯಲು ಏನೂ ಇಲ್ಲ",
    tooBig: "ಈ ಫೈಲ್ ಬ್ಯಾಕಪ್ ಆಗಲು ತುಂಬಾ ದೊಡ್ಡದು.", badFile: "ಇದು ಈ ಆಪ್‌ನ ಬ್ಯಾಕಪ್ ಅಲ್ಲ, ಅಥವಾ ಫೈಲ್ ಹಾಳಾಗಿದೆ.",
    newer: "ಈ ಬ್ಯಾಕಪ್ ಆಪ್‌ನ ಹೊಸ ಆವೃತ್ತಿಯದು. ಆಪ್ ಮತ್ತೆ ತೆರೆದು ಪ್ರಯತ್ನಿಸಿ.",
  },
};

export const MESSAGES: Record<Lang, Msg> = { en, hi, kn };

const LANG_KEY = "lang";
export function initialLang(): Lang {
  try { const v = localStorage.getItem(LANG_KEY); if (v === "en" || v === "hi" || v === "kn") return v; } catch { /* fine */ }
  const n = (typeof navigator !== "undefined" ? navigator.language : "en").toLowerCase();
  return n.startsWith("hi") ? "hi" : n.startsWith("kn") ? "kn" : "en";
}
export function storeLang(l: Lang) { try { localStorage.setItem(LANG_KEY, l); } catch { /* fine */ } document.documentElement.lang = `${l}-IN`; }

export interface I18n { lang: Lang; t: Msg; locale: string; setLang: (l: Lang) => void }
export const I18nContext = createContext<I18n>({ lang: "en", t: en, locale: "en-IN", setLang: () => undefined });
export const useI18n = () => useContext(I18nContext);

/** "Today", "Yesterday", or a short date in the chosen language. */
export function dayText(date: string, now: string, i: I18n): string {
  if (date === now) return i.t.today;
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const prev = new Date(Number(now.slice(0, 4)), Number(now.slice(5, 7)) - 1, Number(now.slice(8)) - 1);
  if (prev.getFullYear() === y && prev.getMonth() === m - 1 && prev.getDate() === d) return i.t.yesterday;
  return new Date(y, m - 1, d).toLocaleDateString(i.locale, { weekday: "short", day: "numeric", month: "short", ...(String(y) === now.slice(0, 4) ? {} : { year: "numeric" }) });
}
export const monthText = (month: string, i: I18n, short = false) => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(y, m - 1, 1).toLocaleDateString(i.locale, short ? { month: "short" } : { month: "long", year: "numeric" });
};
export const dateText = (date: string, i: I18n) => {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString(i.locale, { day: "numeric", month: "short", year: "numeric" });
};
