<p align="center">
  <img src="docs/assets/icon.png" width="112" alt="Mizan app icon" />
</p>

<h1 align="center">Mizan</h1>

<p align="center">
  <b>A private expense manager that reads your bank SMS alerts on iPhone.</b><br/>
  <sub>Automatic SMS import • Live bank balance • Bill splits • Monthly payments • Zakat</sub>
</p>

<p align="center">
  <a href="#install">Install</a> ·
  <a href="#features">Features</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#privacy-and-security">Privacy</a> ·
  <a href="docs/iphone-pairing.md">iPhone pairing</a>
</p>

<p align="center">
  <sub><b>Requires iOS 26 or later.</b> Self-hosted on free Vercel and Neon accounts. No App Store, no bank login.</sub>
</p>

<p align="center">
  <img src="docs/screenshots/iphone-dashboard.png" width="230" alt="Dashboard on iPhone" />&nbsp;&nbsp;
  <img src="docs/screenshots/iphone-transactions.png" width="230" alt="Transactions on iPhone" />&nbsp;&nbsp;
  <img src="docs/screenshots/iphone-dashboard-dark.png" width="230" alt="Dashboard in dark mode" />
</p>

Your bank already texts you about every payment. **Mizan reads those texts and turns them into a clean record of your spending, income and balance**, a few seconds after each one arrives. You don't log anything by hand, and you never give anyone your bank login.

**It runs on your own free hosting.** Deploy your copy to Vercel and Neon in about ten minutes, add it to your iPhone's Home Screen, and scan one QR code to connect the Mizan Shortcut. Your data lives in your own database, and only you can sign in.

<sub>All screenshots use made-up sample data.</sub>

---

<table>
<tr>
<td width="40%" valign="top">

### Nothing to type in

An iPhone Shortcut forwards each bank alert the moment it arrives. Mizan reads the amount, direction, date, who it was with and the category. Re-sent alerts are spotted, and transfers between your own accounts are kept out of your spending.

</td>
<td width="60%"><img src="docs/screenshots/desktop-transactions.png" width="100%" alt="Transactions" /></td>
</tr>
<tr>
<td width="40%" valign="top">

### Know where your money went

Expenses, income and net flow for any period, compared with the period before. Spending trends, categories, top recipients and a live balance for each bank, in light or dark mode.

</td>
<td width="60%"><img src="docs/screenshots/desktop-dashboard-light.png" width="100%" alt="Dashboard" /></td>
</tr>
<tr>
<td width="40%" valign="top">

### Every payment, by day

A day, week or month calendar of everything in and out. Tap a day to see its payments, or search, filter, edit and export in Transactions.

</td>
<td width="60%"><img src="docs/screenshots/desktop-calendar.png" width="100%" alt="Calendar" /></td>
</tr>
<tr>
<td width="40%" valign="top">

### Zakat, worked out for you

Checks your savings against the gold or silver nisab using live metal prices, and keeps a record of each year's Zakat and set-asides for charity.

</td>
<td width="60%"><img src="docs/screenshots/desktop-zakat.png" width="100%" alt="Zakat" /></td>
</tr>
</table>

---

## Features

| | |
|---|---|
| **Automatic SMS import** | The Mizan Shortcut sends each bank alert to Mizan. Mizan reads the amount, the direction (spent or received), the date, who it was with and the category. |
| **One-scan iPhone pairing** | Open **Connect iPhone**, scan the QR code, tap two buttons. The Shortcut saves your Mizan's address and its own key by itself. A dot in the menu shows red until an iPhone is connected, then green. |
| **Review inbox** | Mizan never guesses. Alerts it can't read with confidence wait for you to confirm, such as reversals, pending payments, foreign currency or unknown wording. |
| **Live bank balance** | Set your balance once. Every transaction after that keeps it up to date, and editing or deleting a transaction corrects it. Works with several banks, with a filter for each. |
| **Own-account transfers** | Money moved between your own accounts isn't counted as spending or income. Track a single account and every rupee in and out still counts. |
| **Dashboard** | Expenses, income and net flow for any period, compared with the period before, plus spending trends, categories and top recipients. |
| **Transactions and calendar** | Search, filter, edit, add cash spending by hand, export to CSV, or see every payment on a day, week or month calendar. |
| **Recipients** | Everyone you pay or receive from, with totals and full history. |
| **Monthly payments** | A checklist for rent, bills and fees that starts fresh each month and suggests the matching payment so you can tick it off in one tap. |
| **Bill splits** | Paid for everyone? Split a payment between people, share each person a receipt image from your phone, and tick their share off when their money comes in. Mizan spots the repayment for you. |
| **Savings plan and spending check** | See how much you can realistically save each month, set limits per category, and get a gentle nudge when spending runs ahead of usual. |
| **Set-asides** | Rules such as "10% of every remittance for charity". Mizan tracks what has built up and what you've paid out. |
| **Zakat** | Checks your savings against the gold or silver nisab using live metal prices, and keeps a record of each year's Zakat. |
| **Any bank, any currency** | Add your banks and teach Mizan a new bank's alert format by pasting one example. Amounts can be shown in PKR, INR, USD, GBP, EUR, AED, SAR and more. |
| **Push notifications** | Get notified when a payment is imported ("Spent Rs 2,450 · Imtiaz") or an alert needs review. Amounts and names can be hidden in Settings. |
| **Offline queue** | No internet when an alert arrives? The Shortcut keeps it. Back online, tap **More → Import queued messages**. |
| **Recycle bin and backups** | Deleted transactions wait 30 days before they're gone. Nightly backups go to your own Google Drive, plus a one-tap download. |

<p align="center">
  <img src="docs/screenshots/iphone-calendar.png" width="190" alt="Calendar" />&nbsp;
  <img src="docs/screenshots/iphone-monthly.png" width="190" alt="Monthly payments" />&nbsp;
  <img src="docs/screenshots/iphone-sms-setup.png" width="190" alt="Connect iPhone" />&nbsp;
  <img src="docs/screenshots/iphone-settings.png" width="190" alt="Settings" />
</p>

## How it works

```
Bank SMS -> iPhone Messages -> Mizan Shortcut -> HTTPS + device key -> Mizan (Vercel) -> Postgres (Neon)
                                                                            |
                                          You, on the Home Screen app <-----+
```

1. Your bank sends an SMS alert, for example *"PKR 2,450.00 debited from A/C \*\*\*\*1234 at FOODPANDA"*.
2. A Shortcuts **Message automation** runs as the alert arrives and posts the text to your Mizan with that iPhone's own key. If you're offline, the Shortcut queues it and sends it later.
3. Mizan checks the sender is one of your banks, reads the alert and saves the transaction. If anything is unclear, the alert goes to the Review inbox.
4. You open Mizan from your Home Screen and everything is already there.

## What you need

- **An iPhone on iOS 26 or later**, with the built-in **Shortcuts** app. Mizan is built and tested for iOS 26, and earlier versions aren't supported. The web app itself also works in any modern browser on a computer or iPad.
- A free **[GitHub](https://github.com)** account.
- A free **[Vercel](https://vercel.com)** account to host the app.
- A free **[Neon](https://neon.tech)** account for the database. Any PostgreSQL 14+ database works.
- Optional: a Google Cloud OAuth client for Google Drive backups.

You don't need a Mac, Xcode or an Apple Developer account. Mizan is a web app you add to your Home Screen, not an App Store download.

## Install

### 1. Deploy your own copy

This takes about 10 minutes, and **only one setting is required**. The app walks you through the rest.

1. **Fork this repository** to your GitHub account.
2. **Create a database.** In Neon, create a project and copy its **pooled** connection string. It looks like `postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require`.
3. **Deploy on Vercel.** Choose **Add New → Project**, import your fork, and add one environment variable:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the Neon connection string from step 2 |

   Click **Deploy**. The build creates the database tables for you.
4. **Open your new app** (`https://your-app.vercel.app`). A short setup wizard takes you through:
   1. **Database:** checks the connection.
   2. **Passphrase:** the one passphrase you'll sign in with.
   3. **Banks:** the banks you get alerts from and their SMS sender names.
   4. **Currency, your name, and a test:** pick your currency, enter your name as banks print it (so transfers between your own accounts aren't counted as spending), and paste a real alert to check that Mizan reads it correctly.
   5. **iPhone:** scan a QR code to connect your iPhone (see below).
   6. **Finish.**
5. **Add it to your Home Screen.** Open your app in **Safari**, tap **Share**, then **Add to Home Screen**. Open Mizan from the Home Screen icon to use it full screen and get notifications.

### 2. Connect your iPhone

Open **Connect iPhone** in the app's menu. The dot beside it is red until an iPhone is connected, then green.

1. On your computer, Mizan shows a QR code. Point your iPhone's **Camera** at it and tap the link. (Already using
   Mizan on the iPhone? The same two buttons are right on the page.)
2. First time only: tap **Get the Shortcut**, then **Add Shortcut**.
3. Tap **Connect this iPhone** and allow it. The Shortcut saves your Mizan's address and a key for that iPhone by
   itself: nothing to copy or type. Mizan shows the iPhone as connected once the phone confirms it saved the key.
4. Create the automation: in **Shortcuts → Automation**, tap **+ → Message**, set **Sender** to your bank's name or
   short code, choose **Run Immediately**, and pick the **Mizan** Shortcut. Repeat for each bank.

Your next bank alert appears in Mizan within a few seconds.

No internet when an alert arrives? The Shortcut keeps it. Back online, open Mizan on your iPhone, tap **More**, then
**Import queued messages**. See [`docs/iphone-pairing.md`](docs/iphone-pairing.md) for how pairing works.

**Using a bank Mizan doesn't know yet?** Go to **Settings → Bank messages** and paste one example alert. Mizan learns that bank's format from it, and **Test a message** shows exactly what it reads.

<details>
<summary><b>Self-host with Docker instead of Vercel</b></summary>

Prefer your own computer or server to Vercel? This starts Mizan on an empty database:

```bash
docker compose up --build -d
```

Open <http://localhost:3000> and the setup wizard takes you through the same steps as above. Your data stays in a Docker volume on that machine. Stop it with `docker compose down`, and add `-v` only if you want to erase your data.

**Only want a look?** `docker compose -f docker-compose.demo.yml up --build -d` starts a separate copy filled with made-up sample data at <http://localhost:3002> (passphrase `mizan-demo-2026`). It's for trying the app and taking screenshots, never for real use. Remove it with `docker compose -f docker-compose.demo.yml down -v`.

**Setting Mizan up with an AI assistant?** It's fine to ask one to deploy it for you. The repository's [`AGENTS.md`](AGENTS.md) tells assistants never to add sample data or skip the wizard: you start empty and choose your own passphrase, banks and name in the setup wizard.

</details>

## Privacy and security

- **Single owner.** There's one passphrase, stored only as a scrypt hash. Every page and API route checks the session on the server.
- **Hardened sessions.** Cookies are signed, HttpOnly, Secure and SameSite. Every write needs a CSRF token and a same-origin request. Sign-in and SMS endpoints are rate limited.
- **SMS is data, never instructions.** Only alerts from senders you trust are accepted, and OTPs and promotional messages are ignored. Only a redacted copy of an unclear alert is kept, and it is deleted once you resolve it.
- **A key per iPhone.** Each paired iPhone gets its own key, stored only as a hash. Remove an iPhone and its key stops working at once.
- **No duplicates.** Re-sent alerts are detected by a fingerprint and the bank's reference number.
- **Your data stays with you.** It lives in your own database, and Mizan has no analytics or third-party trackers.

## Limitations

- **iPhone with iOS 26 or later.** Automatic import uses iOS Shortcuts automations, and Mizan is built and tested for iOS 26. On other phones you can still add transactions by hand or post to the `/api/sms` endpoint yourself.
- **Built around South Asian bank alerts.** The built-in reader is tuned for Pakistani bank alerts and `PKR`/`Rs` amounts. You can teach it other banks from a pasted example, but expect a few alerts in the Review inbox at first.
- **One currency.** The currency you choose changes how amounts are shown. Amounts are never converted between currencies.
- **One user.** There's no sign-up and no shared accounts. If you forget the passphrase, set a new `ADMIN_PASSWORD_HASH` in Vercel.
- **Free-tier hosting.** Neon suspends an idle database, so the first load after a pause takes a second or two longer.

## Configuration

Only `DATABASE_URL` is required. Everything else is either created by the setup wizard and stored in your database, or optional. A value set as an environment variable always overrides the stored one. See [`.env.example`](.env.example).

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | **Required.** Postgres connection string (pooled, `sslmode=require`). |
| `ADMIN_PASSWORD_HASH` | Optional, and best left empty: if set, the setup wizard is skipped. |
| `SESSION_SECRET` | Optional. 32+ random characters for signing sessions. |
| `SMS_INGEST_TOKEN` | Optional. A shared token from older setups; paired iPhones use their own keys instead. |
| `SMS_AUTO_IMPORT` | Optional. Set to `false` to send every alert to the Review inbox. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Optional. Web push keys (created by setup if empty). |
| `CRON_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional. Nightly Google Drive backups. |

<details>
<summary><b>Google Drive backups (optional)</b></summary>

Create an OAuth client in Google Cloud with the `drive.file` scope. Add `https://your-app.vercel.app/api/backup/google/callback` as a redirect URI, then set the three variables above and connect Drive from **Backups** in the app. Vercel Cron runs the backup nightly (see `vercel.json`).

</details>

## Development

You need Node.js 20 or later and a PostgreSQL database.

```bash
npm ci
cp .env.example .env.local        # set DATABASE_URL
npm run migrate                   # create or upgrade the tables
npm run dev                       # http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm test` | Unit tests (SMS parser, money, insights, Zakat and more) |
| `npm run typecheck` | TypeScript check |
| `npm run migrate` | Apply `migrations/*.sql` (safe to run repeatedly) |
| `npm run hash-password -- 'passphrase'` | Make a passphrase hash for `ADMIN_PASSWORD_HASH` |
| `npm run e2e` | End-to-end checks against a running instance (`BASE_URL`, `MIZAN_PASSWORD`, `SMS_INGEST_TOKEN`) |

**Project layout**

```
src/app/          Pages (Next.js App Router) and API routes under src/app/api
src/components/   UI components
src/lib/          Business logic: money, SMS parsing (src/lib/sms), banks, Zakat, backups
migrations/       SQL migrations, applied in order
scripts/          Migrate, sample data for the local demo, password hashing, end-to-end checks
tests/            Vitest unit tests
```

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router) with React 19 and TypeScript
- PostgreSQL ([Neon](https://neon.tech)) via `node-postgres`
- [Recharts](https://recharts.org) for charts
- [Zod](https://zod.dev) for validation
- [Vitest](https://vitest.dev) for tests
- Hosted on [Vercel](https://vercel.com), with web push and Vercel Cron
