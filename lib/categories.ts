// The fixed list of categories and the words that point to each one.

export type SpendCategory = "food" | "groceries" | "travel" | "bills" | "shopping" | "health" | "rent" | "other";
export type IncomeCategory = "salary" | "business" | "refund" | "income";
export type Category = SpendCategory | IncomeCategory;

/** Money out first, then money in. Whether an entry is income comes from its category, so the two never disagree. */
export const CATEGORIES: { key: Category; label: string; income: boolean }[] = [
  { key: "food", label: "Food", income: false },
  { key: "groceries", label: "Groceries", income: false },
  { key: "travel", label: "Travel", income: false },
  { key: "bills", label: "Bills", income: false },
  { key: "shopping", label: "Shopping", income: false },
  { key: "health", label: "Health", income: false },
  { key: "rent", label: "Rent & EMI", income: false },
  { key: "other", label: "Other", income: false },
  { key: "salary", label: "Salary", income: true },
  { key: "business", label: "Business", income: true },
  { key: "refund", label: "Refund", income: true },
  { key: "income", label: "Other income", income: true },
];
export const isIncomeCategory = (k: Category) => k === "salary" || k === "business" || k === "refund" || k === "income";
export const CATEGORY_KEYS = CATEGORIES.map(c => c.key);
export const categoryLabel = (k: Category) => CATEGORIES.find(c => c.key === k)?.label ?? "Other";
export const isCategory = (k: unknown): k is Category => typeof k === "string" && (CATEGORY_KEYS as string[]).includes(k);

/** Words (English and common Indian ones, as people type them in English letters). */
const INCOME_WORDS: Record<IncomeCategory, string[]> = {
  // Only words that can't describe paying for something: "pay electricity" or "client lunch" must stay spends.
  salary: ["वेतन", "तनख्वाह", "पगार", "ಸಂಬಳ", "salary", "payslip", "stipend", "bonus", "wages", "payday", "pension"],
  business: ["freelance", "sales", "invoice paid", "shop sales"],
  refund: ["refund", "cashback", "reversal", "reimbursement"],
  income: ["income", "received", "credited", "dividend"],
};

const WORDS: Record<Exclude<SpendCategory, "other">, string[]> = {
  food: ["चाय", "खाना", "नाश्ता", "होटल", "ಚಹಾ", "ಕಾಫಿ", "ಊಟ", "ತಿಂಡಿ", "ಹೋಟೆಲ್", "chai", "tea", "coffee", "lunch", "dinner", "breakfast", "snack", "snacks", "hotel", "restaurant", "cafe", "canteen", "mess", "tiffin",
    "swiggy", "zomato", "idli", "dosa", "vada", "biryani", "meals", "meal", "thali", "pizza", "burger", "juice", "icecream", "sweets", "bakery",
    "parcel", "food", "khana", "nashta", "pani puri", "chaat", "samosa", "paratha", "dhaba"],
  groceries: ["दूध", "सब्ज़ी", "सब्जी", "राशन", "किराना", "ಹಾಲು", "ತರಕಾರಿ", "ದಿನಸಿ", "ಅಕ್ಕಿ", "milk", "vegetables", "veggies", "veg", "sabzi", "sabji", "fruits", "fruit", "kirana", "grocery", "groceries", "dmart", "bigbasket",
    "blinkit", "zepto", "instamart", "rice", "atta", "dal", "oil", "eggs", "egg", "bread", "curd", "doodh", "ration", "provisions", "chicken", "mutton", "fish", "meat"],
  travel: ["ऑटो", "बस", "पेट्रोल", "टैक्सी", "ಆಟೋ", "ಬಸ್", "ಪೆಟ್ರೋಲ್", "auto", "bus", "metro", "uber", "ola", "rapido", "cab", "taxi", "petrol", "diesel", "fuel", "cng", "train", "flight", "toll", "parking",
    "fastag", "ticket", "travel", "bike", "service", "redbus", "irctc"],
  bills: ["बिजली", "बिल", "रिचार्ज", "ಕರೆಂಟ್", "ವಿದ್ಯುತ್", "ಬಿಲ್", "ರೀಚಾರ್ಜ್", "electricity", "current", "bescom", "light", "recharge", "mobile", "phone", "wifi", "internet", "broadband", "gas", "cylinder", "water",
    "dth", "netflix", "hotstar", "prime", "spotify", "jio", "airtel", "vi", "bsnl", "bill", "bills", "insurance", "lic", "fees", "fee", "school", "tuition"],
  shopping: ["कपड़े", "ಬಟ್ಟೆ", "amazon", "flipkart", "myntra", "meesho", "ajio", "clothes", "shirt", "saree", "kurta", "dress", "shoes", "chappal", "slippers",
    "shopping", "gift", "watch", "bag", "cosmetics", "salon", "haircut"],
  health: ["दवा", "दवाई", "डॉक्टर", "ಔಷಧಿ", "ಮಾತ್ರೆ", "ಡಾಕ್ಟರ್", "medicine", "medicines", "medical", "tablet", "tablets", "doctor", "hospital", "clinic", "pharmacy", "chemist", "test", "lab", "dental",
    "dentist", "gym", "yoga", "health", "dawai", "checkup"],
  rent: ["किराया", "ಬಾಡಿಗೆ", "rent", "maintenance", "emi", "loan", "pg", "hostel", "deposit"],
};

const INCOME = new Map<string, Category>();
for (const [cat, words] of Object.entries(INCOME_WORDS)) for (const w of words) INCOME.set(w, cat as Category);
const LOOKUP = new Map<string, Category>();
for (const [cat, words] of Object.entries(WORDS)) for (const w of words) if (!LOOKUP.has(w)) LOOKUP.set(w, cat as Category);

/** Lower-case words of a note, without punctuation. */
export const wordsOf = (note: string) => note.toLowerCase().replace(/[^a-z0-9ऀ-෿\s]/g, " ").split(/\s+/).filter(Boolean);

/**
 * Category for a note: a word the person taught us wins, then money-in words, then two-word and one-word built-in matches,
 * then a plural or longer form ("medicines", "petrol pump"), else Other.
 */
export function guessCategory(note: string, learned: ReadonlyMap<string, Category>): Category {
  const words = wordsOf(note);
  for (const w of words) { const c = learned.get(w); if (c) return c; }
  // Money-in words win anywhere in the note: "amazon refund" is a refund, not shopping.
  for (const map of [INCOME, LOOKUP]) {
    for (let i = 0; i < words.length - 1; i++) { const c = map.get(`${words[i]} ${words[i + 1]}`); if (c) return c; }
    for (const w of words) { const c = map.get(w); if (c) return c; }
  }
  for (const w of words) {
    if (w.length < 4) continue;
    for (const [k, c] of LOOKUP) if (k.length >= 4 && w.startsWith(k)) return c;
  }
  return "other";
}

const STOP = new Set(["for", "the", "a", "an", "to", "on", "at", "in", "of", "and", "with", "from", "ka", "ki", "ke"]);

/** The word to remember when the person picks a different category: the first meaningful one. */
export function keyWord(note: string): string | null {
  return wordsOf(note).find(w => w.length >= 2 && !STOP.has(w) && !/^\d+$/.test(w)) ?? null;
}
