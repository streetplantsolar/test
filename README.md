# Comn.one

*Say it out loud: "common."*

A trust-based sharing shelf for people who already care about each other. Put up the books,
tools, games, and gear you're happy to lend. Friends reserve, borrow, and return them — with
gentle reminders so things find their way home. Neighborhood and city circles let you widen the
shelf beyond friends, one item at a time, always opt-in.

**The ethos, which is also the product spec:**

- Most things spend most of their life in a closet. Sharing fixes that.
- Trust is the infrastructure; the app is just a shelf and a reminder.
- No middleman profits from generosity: no ads, no data games, no fees on lending, ever.
- "We own things together," not "I monetize my stuff."
- Paid features never gate core access. If a convenience turns out to be essential, it becomes free.

## Running it

Requires **Node 22+** (the database uses Node's built-in `node:sqlite` — no native modules, no
external database, nothing to provision).

```bash
npm install
npm run dev        # http://localhost:3000
```

Production:

```bash
npm run build
npm start
```

The SQLite database is created automatically at `data/comn.db` (override the directory with
`COMN_DATA_DIR`). To try the full flow locally, open two browsers (or one normal + one private
window), create two accounts, friend each other, and lend something.

## What's built

| Area | Details |
| --- | --- |
| Accounts | Email + password (scrypt-hashed), 90-day cookie sessions, password reset by email. No email verification yet. |
| Friends | Add individually by username; accept/decline; remove. |
| Crews | Private friend groups (book club, street, band) joined via invite code — everyone in a crew sees each other's shelves without pairwise friending. |
| Circles | Public neighborhood/city groups anyone can browse and join. Joining exposes nothing by itself. |
| Items | Title, category, description, care notes, optional return window (1–365 days), per-item visibility: *friends & crews* (default) or *also neighbors*. Archive ("shelve away") anytime. |
| Loans | Request (with a note) → owner approves → reserved → owner marks handed over → out (due date set from the item's return window) → owner marks returned. Either side can cancel/decline before handover. |
| Reminders | In-app *and email* at 3-days-out, due-today, and overdue (overdue also pings the owner). Runs as a lazy sweep on requests, plus a cron endpoint (`GET /api/cron/remind`) so reminders go out even when nobody is browsing. |
| Notifications | In-app inbox with unread badge for requests, approvals, handovers, returns, friend activity. |
| Email | Nodemailer over SMTP (`lib/mail.ts`), config via env. Without SMTP configured, emails are logged to the server console so every flow stays testable. |
| Supporter | $0.99/month via Stripe Checkout + webhook + billing portal (`app/api/stripe/*`), active when Stripe env vars are set; a clearly-labeled demo toggle in Settings otherwise. Buys barcode scanning: camera scan (`BarcodeDetector` API) or typed ISBN → Open Library lookup → pre-filled shelf form. Manual adding stays free forever. |
| Support page | Explains the money model in plain words; shows the pay-what-you-want Stripe Payment Link when configured. |

## On money: a recommendation

You asked whether to include tips, pay-what-you-want, or neither. Recommendation: **both of the
following, and nothing else** —

1. **Pay-what-you-want, Wikipedia-style** (one-time, any amount) as the primary channel. It fits
   the ethos perfectly, builds credibility precisely *because* it's refusable, and a small
   "what this costs to run" public ledger makes it trustworthy. This is the one to launch with.
2. **The $0.99/month supporter tier** for convenience features (barcode scanning, and later:
   bulk import, printable shelf labels, stats). It gives regulars a way to help on autopilot and
   gives you a predictable floor. The rule that keeps it honest is already stated on the support
   page: *if a convenience turns out to be essential, it becomes free.*

Skip per-transaction tips between users — the moment money changes hands around a loan, it stops
being a favor and starts being a rental, which is exactly the dynamic this exists to escape.

## Configuration

Copy `.env.example` to `.env` and fill in what you use. **Everything is optional** — with no
env at all, the app runs fully: emails print to the server console, and the supporter tier uses
a labeled demo toggle. The pieces:

| Env vars | Enables |
| --- | --- |
| `APP_URL` | Correct links in emails and Stripe redirects (set to your public URL). |
| `SMTP_HOST/PORT/USER/PASS`, `MAIL_FROM` | Real email: password resets + reminder emails. |
| `CRON_SECRET` | The `GET /api/cron/remind` scheduler endpoint (see below). |
| `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` | Real $0.99/mo supporter checkout, webhook, billing portal. |
| `STRIPE_PAYMENT_LINK` | The pay-what-you-want button on /support. |
| `ALLOWED_ORIGINS` | Form submissions from your domain when behind a proxy. |
| `COMN_DATA_DIR` | Move the SQLite file somewhere durable. |

### Scheduled reminders (production)

The in-app sweep runs whenever someone browses; to guarantee delivery even on quiet days, set
`CRON_SECRET` and add a cron line on the server:

```cron
*/30 * * * *  curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://comn.one/api/cron/remind
```

### Stripe setup (once you want real payments)

1. In the Stripe dashboard: create a **Product** ("Comn.one Supporter") with a **recurring
   $0.99/month price** → copy the `price_...` id into `STRIPE_PRICE_ID`.
2. Developers → API keys → copy the secret key into `STRIPE_SECRET_KEY`.
3. Developers → Webhooks → add endpoint `https://comn.one/api/stripe/webhook` with events
   `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted` → copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
4. Optional: create a **Payment Link** with "customers choose what to pay" for the tip jar →
   `STRIPE_PAYMENT_LINK`.

Subscribing, card updates, and cancellation all round-trip through Stripe Checkout and the
billing portal; the webhook is the single source of truth for the supporter flag.

## Still open (by choice)

- **Moderation**: circles are open-join; you'll eventually want reporting and circle stewards.
- **Photos**: item photos were skipped to stay dependency-free; add object storage when wanted.
- **Email verification** at signup (reset emails make stale addresses self-correcting for now).

## Backups

It's a single SQLite file (`data/comn.db`), so backups are easy. Two options — pick one.

### Easiest: scheduled snapshot (no cloud account needed)

`npm run backup` writes a consistent snapshot to `data/backups/` using SQLite's
`VACUUM INTO` (safe to run while the app is live — no WAL corruption, unlike copying the file
by hand). It keeps the newest 14 by default.

Run it nightly with cron:

```cron
# every night at 3am — adjust the path to your install
0 3 * * *  cd /path/to/comn && /usr/bin/npm run backup >> /var/log/comn-backup.log 2>&1
```

Then copy `data/backups/` offsite however you already move files (rsync, `rclone` to a cloud
drive, etc.). Env knobs: `COMN_BACKUP_DIR`, `COMN_BACKUP_KEEP`.

### More robust: Litestream (continuous, point-in-time restore)

For streaming replication to object storage — so you can lose at most a few seconds — use
[Litestream](https://litestream.io). Copy `litestream.example.yml` to `litestream.yml`, fill in
a bucket (Cloudflare R2 or Backblaze B2 are cheapest for something this small), and run it as a
sidecar. Restore is one command. Full instructions are in the example file.

## Email (password reset + reminder delivery)

You have `hello.comn.one@gmail.com` for outbound mail. Gmail SMTP is the quickest way to send:

1. **Turn on 2-Step Verification** on that Google account, then create an **App Password**
   (Google Account → Security → App passwords). Gmail will *not* accept the normal account
   password over SMTP — you need this 16-character app password.
2. Put the credentials in `.env` (never commit it — `.gitignore` already excludes `.env*`):

   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=hello.comn.one@gmail.com
   SMTP_PASS=your-16-char-app-password
   MAIL_FROM="Comn.one <hello.comn.one@gmail.com>"
   ```

3. Set `APP_URL` to the site's public URL so email links point at the right place. That's it —
   the mailer, password-reset flow, and reminder emails are all built and switch on
   automatically when these vars are present.

   Gmail note: free Gmail sending caps at ~500 messages/day, which is plenty early on. When
   Comn.one grows past that (or if reset emails start landing in spam), move `SMTP_*` to a
   transactional provider like Resend, Postmark, or Amazon SES — same env vars, just different
   host — and set up SPF/DKIM for the comn.one domain.

## Running behind a proxy (Codespaces, Gitpod, tunnels, production)

Every form and button in this app is a **Server Action**, which Next.js protects against CSRF by
requiring the request `Origin` to match the host. Behind a proxy the two differ, and actions fail
with **"Invalid Server Actions request."** `next.config.mjs` already trusts `*.app.github.dev`
(Codespaces) and `*.gitpod.io`. For your own domain, set `ALLOWED_ORIGINS`:

```env
ALLOWED_ORIGINS=comn.one,www.comn.one
```

Local `npm run dev` on `localhost` needs nothing.

**If `npm run dev` says "Cannot find module 'typescript'"** (seen in some Codespaces images):
your npm is skipping devDependencies, usually because `NODE_ENV=production` is set. This repo
now keeps `typescript` in regular `dependencies` and uses a plain-JS `next.config.mjs`, so a
normal `npm install` is enough. If a stale install lingers, run:

```bash
rm -rf node_modules && npm install --include=dev
```

## Code map

```
app/            pages (Next.js App Router, server components + server actions)
  page.tsx        landing        home/        borrow feed
  shelf/          my items       items/[id]/  item detail + full loan flow
  loans/          borrowing & lending         people/      friends & crews
  circles/        neighborhood/city groups    u/[username] profiles
  notifications/  inbox          settings/    profile + supporter
  support/        the money page
  forgot/, reset/[token]/        password reset
  api/cron/remind/               scheduler endpoint for reminder emails
  api/stripe/                    checkout, webhook, billing portal
components/     item card, flash notice, barcode scanner (the one client component)
lib/
  db.ts         schema + migrations + node:sqlite connection
  auth.ts       sessions, scrypt password hashing
  queries.ts    all reads (visibility rules live here)
  actions.ts    all writes (server actions, with authorization checks)
  reminders.ts  staged due-date reminder sweep (in-app + email)
  mail.ts       SMTP mailer (console fallback in dev)
  stripe.ts     Stripe client + config detection
```

No CSS framework, no component library, no ORM: one hand-written stylesheet and SQL you can
read. Total dependencies: `next`, `react`, `react-dom`.
