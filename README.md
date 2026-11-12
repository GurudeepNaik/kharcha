# Kharcha

A simple money tracker for everyday India. Type `chai 20`, tap Save, and see where the month's money went. No sign-up, works offline, and nothing leaves your phone.

**Live:** https://gurudeep-expenses.vercel.app (install it from the browser like an app)

## What it does

- **One-line entry:** `chai 20`, `auto 80 upi`, `rent 12,000 1/11`, `salary 50000`, `+2000 from ravi`, `sip 5000`, `lent ravi 500`. Also `चाय 20` and `ಆಟೋ 60 ನಿನ್ನೆ`.
- **Spent, money in, and invest & insure** kept apart: SIPs, stocks, FD, gold, PPF/NPS, term and health insurance don't count as spending.
- **Every month** for rent, salary, SIPs and bills, with Skip for a single month.
- **Share a payment receipt** from a UPI app (Android, installed): the image is read on the phone and the amount and name are filled in for you to check.
- **People:** money lent and borrowed, per person, with Settle up.
- **Month view:** totals, spending per category against optional budgets, spend per day, last 6 months, and investments by type.
- **Monthly limit**, search and filters, backup and restore, export to Excel (CSV).
- **English, Hindi and Kannada.**

## Privacy

Everything is stored in the browser on the phone (IndexedDB). There's no account and no server-side storage; the receipt reader (tesseract.js) runs on the device from files served by this site. The site counts page visits only, without cookies. Backups are a file you keep.

## Run it

```bash
pnpm install
pnpm dev            # http://localhost:3000
pnpm test           # unit tests: entry reading, storage, backups, repeats, lending, trends, search, receipts
pnpm build && pnpm start -p 3200
pnpm smoke http://localhost:3200      # browser test of the whole app (needs Chrome)
pnpm receipts http://localhost:3200   # receipt images shared in and read on the "phone"
```

Next.js 15 (static), React 19, Tailwind 4, `idb`, `tesseract.js`. The app's name lives in `lib/brand.ts`.
