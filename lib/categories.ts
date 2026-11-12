// The fixed list of categories and the words that point to each one.

export type Category = "food" | "groceries" | "travel" | "bills" | "shopping" | "health" | "rent" | "other";

export const CATEGORIES: { key: Category; label: string }[] = [
  { key: "food", label: "Food" },
  { key: "groceries", label: "Groceries" },
  { key: "travel", label: "Travel" },
  { key: "bills", label: "Bills" },
  { key: "shopping", label: "Shopping" },
  { key: "health", label: "Health" },
  { key: "rent", label: "Rent & EMI" },
  { key: "other", label: "Other" },
];
export const CATEGORY_KEYS = CATEGORIES.map(c => c.key);
export const categoryLabel = (k: Category) => CATEGORIES.find(c => c.key === k)?.label ?? "Other";
export const isCategory = (k: unknown): k is Category => typeof k === "string" && (CATEGORY_KEYS as string[]).includes(k);

/** Words (English and common Indian ones, as people type them in English letters). */
const WORDS: Record<Exclude<Category, "other">, string[]> = {
  food: ["chai", "tea", "coffee", "lunch", "dinner", "breakfast", "snack", "snacks", "hotel", "restaurant", "cafe", "canteen", "mess", "tiffin",
    "swiggy", "zomato", "idli", "dosa", "vada", "biryani", "meals", "meal", "thali", "pizza", "burger", "juice", "icecream", "sweets", "bakery",
    "parcel", "food", "khana", "nashta", "pani puri", "chaat", "samosa", "paratha", "dhaba"],
  groceries: ["milk", "vegetables", "veggies", "veg", "sabzi", "sabji", "fruits", "fruit", "kirana", "grocery", "groceries", "dmart", "bigbasket",
    "blinkit", "zepto", "instamart", "rice", "atta", "dal", "oil", "eggs", "egg", "bread", "curd", "doodh", "ration", "provisions", "chicken", "mutton", "fish", "meat"],
  travel: ["auto", "bus", "metro", "uber", "ola", "rapido", "cab", "taxi", "petrol", "diesel", "fuel", "cng", "train", "flight", "toll", "parking",
    "fastag", "ticket", "travel", "bike", "service", "redbus", "irctc"],
  bills: ["electricity", "current", "bescom", "light", "recharge", "mobile", "phone", "wifi", "internet", "broadband", "gas", "cylinder", "water",
    "dth", "netflix", "hotstar", "prime", "spotify", "jio", "airtel", "vi", "bsnl", "bill", "bills", "insurance", "lic", "fees", "fee", "school", "tuition"],
  shopping: ["amazon", "flipkart", "myntra", "meesho", "ajio", "clothes", "shirt", "saree", "kurta", "dress", "shoes", "chappal", "slippers",
    "shopping", "gift", "watch", "bag", "cosmetics", "salon", "haircut"],
  health: ["medicine", "medicines", "medical", "tablet", "tablets", "doctor", "hospital", "clinic", "pharmacy", "chemist", "test", "lab", "dental",
    "dentist", "gym", "yoga", "health", "dawai", "checkup"],
  rent: ["rent", "maintenance", "emi", "loan", "pg", "hostel", "deposit"],
};

const LOOKUP = new Map<string, Category>();
for (const [cat, words] of Object.entries(WORDS)) for (const w of words) if (!LOOKUP.has(w)) LOOKUP.set(w, cat as Category);

/** Lower-case words of a note, without punctuation. */
export const wordsOf = (note: string) => note.toLowerCase().replace(/[^a-z0-9ऀ-෿\s]/g, " ").split(/\s+/).filter(Boolean);

/**
 * Category for a note: a word the person taught us wins, then two-word and one-word built-in matches,
 * then a plural or longer form ("medicines", "petrol pump"), else Other.
 */
export function guessCategory(note: string, learned: ReadonlyMap<string, Category>): Category {
  const words = wordsOf(note);
  for (const w of words) { const c = learned.get(w); if (c) return c; }
  for (let i = 0; i < words.length - 1; i++) { const c = LOOKUP.get(`${words[i]} ${words[i + 1]}`); if (c) return c; }
  for (const w of words) { const c = LOOKUP.get(w); if (c) return c; }
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
