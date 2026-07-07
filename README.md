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
| Accounts | Email + password (scrypt-hashed), 90-day cookie sessions. No email verification yet. |
| Friends | Add individually by username; accept/decline; remove. |
| Crews | Private friend groups (book club, street, band) joined via invite code — everyone in a crew sees each other's shelves without pairwise friending. |
| Circles | Public neighborhood/city groups anyone can browse and join. Joining exposes nothing by itself. |
| Items | Title, category, description, care notes, optional return window (1–365 days), per-item visibility: *friends & crews* (default) or *also neighbors*. Archive ("shelve away") anytime. |
| Loans | Request (with a note) → owner approves → reserved → owner marks handed over → out (due date set from the item's return window) → owner marks returned. Either side can cancel/decline before handover. |
| Reminders | In-app notifications at 3-days-out, due-today, and overdue (overdue also pings the owner). Runs as a lazy sweep on requests — see "Toward production." |
| Notifications | In-app inbox with unread badge for requests, approvals, handovers, returns, friend activity. |
| Supporter | $0.99/month tier (demo toggle in Settings — payments not wired). Currently buys barcode scanning: camera scan (`BarcodeDetector` API) or typed ISBN → Open Library lookup → pre-filled shelf form. Manual adding stays free forever. |
| Support page | Explains the money model in plain words. |

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

## Toward production

This is a complete, working MVP, deliberately kept small. Before real users:

- **Reminders & email**: the reminder sweep (`lib/reminders.ts`) runs lazily on authenticated
  requests, at most once a minute. Point a real scheduler (cron, or your host's) at it and add
  email/push delivery — in-app reminders only work if people open the app.
- **Payments**: wire Stripe (a Checkout subscription for supporter, a Payment Link for
  pay-what-you-want) and replace the demo toggle in `lib/actions.ts` (`toggleSupporter`).
- **Password reset** needs email; add it alongside reminder email.
- **Backups**: it's one SQLite file — Litestream or a nightly copy of `data/` is plenty for a
  long time.
- **Moderation**: circles are open-join; you'll eventually want reporting and circle stewards.
- **Photos**: item photos were skipped to stay dependency-free; add object storage when wanted.

## Code map

```
app/            pages (Next.js App Router, server components + server actions)
  page.tsx        landing        home/        borrow feed
  shelf/          my items       items/[id]/  item detail + full loan flow
  loans/          borrowing & lending         people/      friends & crews
  circles/        neighborhood/city groups    u/[username] profiles
  notifications/  inbox          settings/    profile + supporter
  support/        the money page
components/     item card, flash notice, barcode scanner (the one client component)
lib/
  db.ts         schema + node:sqlite connection
  auth.ts       sessions, scrypt password hashing
  queries.ts    all reads (visibility rules live here)
  actions.ts    all writes (server actions, with authorization checks)
  reminders.ts  staged due-date reminder sweep
```

No CSS framework, no component library, no ORM: one hand-written stylesheet and SQL you can
read. Total dependencies: `next`, `react`, `react-dom`.
