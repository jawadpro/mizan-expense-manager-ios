# Mizan: Expense Manager for iPhone

**Mizan** is a private, self-hosted expense manager for iPhone users. It reads the SMS alerts your bank already sends you and turns them into a clean, categorised record of your spending, income and bank balance. You don't need to type anything in by hand.

You run your own copy for free on Vercel and Neon, and you install it on your iPhone's Home Screen like an app. An iOS Shortcut forwards each bank alert to it as the alert arrives. Your data stays in your own database, and only you can sign in.

<p align="center">
  <img src="docs/screenshots/iphone-dashboard.png" width="240" alt="Dashboard on iPhone" />
  <img src="docs/screenshots/iphone-transactions.png" width="240" alt="Transactions on iPhone" />
  <img src="docs/screenshots/iphone-dashboard-dark.png" width="240" alt="Dashboard in dark mode" />
</p>

> All screenshots use made-up sample data.

---

## Contents

- [Why Mizan](#why-mizan)
- [Features](#features)
- [Screenshots](#screenshots)
- [How it works](#how-it-works)
- [What you need](#what-you-need)
- [Setup: deploy your own copy](#setup-deploy-your-own-copy)
- [Setup: connect your iPhone](#setup-connect-your-iphone)
- [Self-host with Docker](#self-host-with-docker)
- [Local development](#local-development)
- [Configuration](#configuration)
- [Privacy and security](#privacy-and-security)
- [Limitations](#limitations)
- [Tech stack](#tech-stack)

---

## Why Mizan

Most expense apps want your bank login or ask you to log every purchase yourself. Mizan does neither. Your bank already texts you about every debit and credit, and Mizan reads those texts:

- **No bank login, no third-party aggregator.** Mizan only ever sees the alerts that you forward to it.
- **Nothing to type in.** Payments show up a few seconds after the SMS arrives.
- **Yours alone.** It's a single-owner app on your own free hosting, with no ads, tracking or shared servers.

## Features

| | |
|---|---|
| **Automatic SMS import** | An iPhone Shortcut sends each bank alert to Mizan. Mizan reads the amount, the direction (spent or received), the date, who it was with and the category. |
| **Review inbox** | Mizan never guesses. Alerts it can't read with confidence wait for you to confirm, such as reversals, pending payments, foreign currency or unknown wording. |
| **Live bank balance** | Set your balance once. Every transaction after that keeps it up to date, and editing or deleting a transaction corrects it. Works with several banks, with a filter for each. |
| **Dashboard** | Expenses, income and net flow for any period, compared with the period before, plus spending trends, categories and top recipients. |
| **Transactions and calendar** | Search, filter, edit, add cash spending by hand, export to CSV, or see every payment on a day, week or month calendar. |
| **Monthly payments** | A checklist for rent, bills and fees that starts fresh each month and suggests the matching payment so you can tick it off in one tap. |
| **Bill splits** | Paid for everyone? Split a payment between people, share each person a receipt image from your phone, and tick their share off when their money comes in. Mizan spots the repayment for you. |
| **Spending check** | Set monthly limits per category and get a gentle nudge when spending runs ahead of usual. |
| **Set-asides** | Rules such as "10% of every remittance for charity". Mizan tracks what has built up and what you've paid out. |
| **Zakat** | Checks your savings against the gold or silver nisab using live metal prices, and keeps a record of each year's Zakat. |
| **Any bank, any currency** | Add your banks and teach Mizan a new bank's alert format by pasting one example. You can show amounts in PKR, INR, USD, GBP, EUR, AED, SAR and more. |
| **Push notifications** | Get notified on your iPhone when a payment is imported ("Spent Rs 2,450 · Imtiaz") or an alert needs review. Amounts and names can be hidden in Settings. |
| **Backups** | Nightly backups to your own Google Drive, plus a one-tap download. |
| **Light and dark mode** | Follows your iPhone's setting, or pick one yourself. |

## Screenshots

### iPhone

<p align="center">
  <img src="docs/screenshots/iphone-calendar.png" width="200" alt="Calendar" />
  <img src="docs/screenshots/iphone-monthly.png" width="200" alt="Monthly payments" />
  <img src="docs/screenshots/iphone-sms-setup.png" width="200" alt="Connect iPhone" />
  <img src="docs/screenshots/iphone-settings.png" width="200" alt="Settings" />
</p>

### iPad and desktop browser

| Dashboard (light) | Dashboard (dark) |
|---|---|
| ![Dashboard](docs/screenshots/desktop-dashboard-light.png) | ![Dashboard, dark mode](docs/screenshots/desktop-dashboard-dark.png) |
| **Transactions** | **Calendar** |
| ![Transactions](docs/screenshots/desktop-transactions.png) | ![Calendar](docs/screenshots/desktop-calendar.png) |
| **Zakat** | |
| ![Zakat](docs/screenshots/desktop-zakat.png) | |

## How it works

```
 Bank SMS ──▶ iPhone Messages ──▶ iOS Shortcut ──HTTPS + token──▶ Mizan (Vercel) ──▶ Postgres (Neon)
                                                                        │
                                       You, on the Home Screen app ◀────┘
```

1. Your bank sends an SMS alert, for example *"PKR 2,450.00 debited from A/C \*\*\*\*1234 at FOODPANDA"*.
2. A Shortcuts **automation** runs as the message arrives and posts the text to your Mizan with a secret token. If you're offline, the Shortcut queues the message and sends it later.
3. Mizan checks the sender is one of your banks, reads the alert and saves the transaction. If anything is unclear, the alert goes to the Review inbox.
4. You open Mizan from your Home Screen and everything is already there.

## What you need

- **An iPhone** running iOS 17 or later, with the built-in **Shortcuts** app. Automatic SMS forwarding relies on iOS Shortcuts, so this part needs an iPhone. The web app itself works in any modern browser.
- A free **[GitHub](https://github.com)** account.
- A free **[Vercel](https://vercel.com)** account to host the app.
- A free **[Neon](https://neon.tech)** account for the database. Any PostgreSQL 14+ database works.
- Optional: a Google Cloud OAuth client for Google Drive backups.

You don't need a Mac, Xcode or an Apple Developer account. Mizan is a web app you add to your Home Screen, not an App Store download.

## Setup: deploy your own copy

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
5. **Install it on your iPhone.** Open your app in **Safari**, tap **Share**, then **Add to Home Screen**. Open Mizan from the Home Screen icon to use it full screen and get notifications.

## Setup: connect your iPhone

Open **Connect iPhone** in the app's menu. The dot beside it is red until an iPhone is connected, then green.

1. On your computer, Mizan shows a QR code. Point your iPhone's **Camera** at it and tap the link. (Already using
   Mizan on the iPhone? The same two buttons are right on the page.)
2. First time only: tap **Get the Shortcut**, then **Add Shortcut**.
3. Tap **Connect this iPhone** and allow it. The Shortcut saves your Mizan's address and a key for that iPhone by
   itself: nothing to copy or type. Mizan shows the iPhone as connected once the phone confirms it saved the key.
4. Create the automation: in **Shortcuts → Automation**, tap **+ → Message**, set **Sender** to your bank's name or
   short code, choose **Run Immediately**, and pick the **Mizan** Shortcut. Repeat for each bank.
5. Tap the Mizan Shortcut once by hand to send a test, then wait for your next bank alert. It appears in Mizan within
   a few seconds.

No internet when an alert arrives? The Shortcut keeps it. Back online, open the **Review inbox** on your iPhone and tap
**Import queued messages**. See [`docs/iphone-pairing.md`](docs/iphone-pairing.md) for how pairing works.

**Using a bank Mizan doesn't know yet?** Go to **Settings → Bank messages** and paste one example alert. Mizan learns that bank's format from it, and **Test a message** shows exactly what it reads.

## Self-host with Docker

Prefer your own computer or server to Vercel? This starts Mizan on an empty database:

```bash
docker compose up --build -d
```

Open <http://localhost:3000> and the setup wizard takes you through the same steps as above. Your data stays in a Docker volume on that machine. Stop it with `docker compose down`, and add `-v` only if you want to erase your data.

**Only want a look?** `docker compose -f docker-compose.demo.yml up --build -d` starts a separate copy filled with made-up sample data at <http://localhost:3002> (passphrase `mizan-demo-2026`). It's for trying the app and taking screenshots, never for real use. Remove it with `docker compose -f docker-compose.demo.yml down -v`.

**Setting Mizan up with an AI assistant?** It's fine to ask one to deploy it for you. The repository's [`AGENTS.md`](AGENTS.md) tells assistants never to add sample data or skip the wizard: you start empty and choose your own passphrase, banks and name in the setup wizard.

## Local development

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

## Configuration

Only `DATABASE_URL` is required. Everything else is either created by the setup wizard and stored in your database, or optional. A value set as an environment variable always overrides the stored one. See [`.env.example`](.env.example).

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | **Required.** Postgres connection string (pooled, `sslmode=require`). |
| `ADMIN_PASSWORD_HASH` | Optional, and best left empty: if set, the setup wizard is skipped. |
| `SESSION_SECRET` | Optional. 32+ random characters for signing sessions. |
| `SMS_INGEST_TOKEN` | Optional. 32+ random characters; the token the Shortcut sends. |
| `SMS_AUTO_IMPORT` | Optional. Set to `false` to send every alert to the Review inbox. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Optional. Web push keys (created by setup if empty). |
| `CRON_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional. Nightly Google Drive backups. |

**Google Drive backups (optional).** Create an OAuth client in Google Cloud with the `drive.file` scope. Add `https://your-app.vercel.app/api/backup/google/callback` as a redirect URI, then set the three variables above and connect Drive from **Backups** in the app. Vercel Cron runs the backup nightly (see `vercel.json`).

## Privacy and security

- **Single owner.** There's one passphrase, stored only as a scrypt hash. Every page and API route checks the session on the server.
- **Hardened sessions.** Cookies are signed, HttpOnly, Secure and SameSite. Every write needs a CSRF token and a same-origin request. Sign-in and SMS endpoints are rate limited.
- **SMS is data, never instructions.** Only alerts from senders you trust are accepted, and OTPs and promotional messages are ignored. Only a redacted copy of an unclear alert is kept, and it is deleted once you resolve it.
- **No duplicates.** Re-sent alerts are detected by a fingerprint and the bank's reference number.
- **Your data stays with you.** It lives in your own database, and Mizan has no analytics or third-party trackers.

## Limitations

- **iPhone only for SMS forwarding.** Automatic import uses iOS Shortcuts automations. On other phones you can still add transactions by hand or post to the `/api/sms` endpoint yourself.
- **Built around South Asian bank alerts.** The built-in reader is tuned for Pakistani bank alerts and `PKR`/`Rs` amounts. You can teach it other banks from a pasted example, but expect a few alerts in the Review inbox at first.
- **One currency.** The currency you choose changes how amounts are shown. Amounts are never converted between currencies.
- **One user.** There's no sign-up and no shared accounts. If you forget the passphrase, set a new `ADMIN_PASSWORD_HASH` in Vercel.
- **Free-tier hosting.** Neon suspends an idle database, so the first load after a pause takes a second or two longer.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router) with React 19 and TypeScript
- PostgreSQL ([Neon](https://neon.tech)) via `node-postgres`
- [Recharts](https://recharts.org) for charts
- [Zod](https://zod.dev) for validation
- [Vitest](https://vitest.dev) for tests
- Hosted on [Vercel](https://vercel.com), with web push and Vercel Cron
