# Pigeonhole

**File email where you would, in one click.**

Pigeonhole is an Outlook add-in that learns how you already file email —
every project folder, every subfolder — and puts the right folder one click
away. Click a suggestion and the email is marked read and moved. Training
runs entirely on your machine: no server, no telemetry, no AI tokens.

> *The name:* carrier pigeons deliver mail; pigeonholes are the compartments
> you sort it into.

## What's here

```
pigeonhole/
├── addin/                  The Outlook add-in (static web app, no build step)
│   ├── manifest.xml        Office add-in manifest (sideload this)
│   ├── assets/             Ribbon/store icons
│   └── src/
│       ├── taskpane.html   Pane UI
│       ├── taskpane.css
│       ├── app.js          Orchestration (Office.js ↔ classifier ↔ Graph)
│       ├── classifier.js   Naive Bayes model — pure JS, no dependencies
│       ├── graph.js        Minimal Microsoft Graph client (batched)
│       ├── auth.js         MSAL / Nested App Authentication
│       ├── store.js        localStorage persistence (per mailbox)
│       └── license.js      7-day trial + offline license keys
├── website/                Marketing site (single static page)
├── scripts/
│   ├── test-classifier.js  Classifier accuracy smoke test (node)
│   ├── make-license-key.js Key generator for your payment webhook
│   └── make-icons.py       Regenerates the PNG icons
└── docs/
    ├── SETUP.md            Azure registration, hosting, sideloading
    └── ARCHITECTURE.md     How training & suggestion ranking work
```

## How it works (60 seconds)

1. **Train** — the add-in walks your folder tree via Microsoft Graph,
   samples the ~50 most recent messages in each folder (sender, subject,
   recipients — bodies are never read), and trains a multinomial Naive
   Bayes classifier in the taskpane. A 100-folder mailbox trains from
   ~5,000 messages in well under two minutes; the model build itself takes
   milliseconds.
2. **Suggest** — with the pane pinned, selecting any email instantly shows
   the top 5 folders it belongs in, plus an **Other folders** row revealing
   ranks 6–10.
3. **File** — one click marks the message read and moves it. Each confirmed
   filing is fed back into the model, so accuracy improves as you go.
4. **⚡ One-click rules** — the bolt button beside any suggestion creates a
   real server-side Outlook rule (*from this sender → that folder, mark
   read*) without opening the rules dialog.

**Privacy:** the model is word-count statistics in `localStorage` on your
device. The add-in talks to exactly one service — Microsoft Graph, under
your own sign-in. There is no Pigeonhole backend.

## Quick start (development)

```bash
cd addin
npm install
npm run dev-certs   # one-time: trusted https certs for localhost
npm run dev         # serves the add-in at https://localhost:3000
```

Then:

1. Create a (free) Azure App Registration and paste its client id into
   `addin/src/auth.js` — 5 minutes, see [docs/SETUP.md](docs/SETUP.md).
2. In `manifest.xml`, replace `https://addin.pigeonhole.email` with
   `https://localhost:3000`.
3. Sideload `manifest.xml` in Outlook (**Get Add-ins → My add-ins → Add a
   custom add-in → Add from file**).
4. Open any email, click **File with Pigeonhole**, press **Train**.

To ship: host `addin/` on any static host (GitHub Pages, Azure Static Web
Apps, Cloudflare Pages), point the manifest URLs at it, and distribute the
manifest (or publish to AppSource). The website in `website/` deploys the
same way.

## Testing

```bash
node scripts/test-classifier.js   # trains on a synthetic 12-folder mailbox
```

Current result: 100% top-1 / 100% top-5 on held-out synthetic messages;
480-message training run completes in ~8 ms.

## Licensing model

7-day free trial (starts on first launch, tracked locally), then $30/year.
Keys validate **offline** — they encode a hash of the buyer's email and an
expiry date. Generate them from your payment provider's webhook:

```bash
node scripts/make-license-key.js buyer@example.com 2027-07-07
```

Before shipping, change `VENDOR_SECRET` in **both** `addin/src/license.js`
and `scripts/make-license-key.js`.

## Platform support

- **Classic Outlook for Windows** (Microsoft 365) — primary target
- **New Outlook for Windows** and **Outlook on the web** — same manifest
- Requires an Exchange Online / Microsoft 365 mailbox (Graph API)
- **Gmail** — roadmap; `classifier.js` is host-agnostic by design, so a
  Gmail port only needs a thin Gmail-API equivalent of `graph.js`
