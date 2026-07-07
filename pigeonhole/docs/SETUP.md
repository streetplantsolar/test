# Pigeonhole — setup & deployment

## 1. Azure App Registration (one-time, free)

The add-in calls Microsoft Graph with the user's own sign-in. That requires
an app registration — no Azure spend, any Microsoft account works.

1. Go to <https://portal.azure.com> → **Microsoft Entra ID** →
   **App registrations** → **New registration**.
2. Name: `Pigeonhole`. Supported account types: **Accounts in any
   organizational directory and personal Microsoft accounts**.
3. After creating, note the **Application (client) ID** and paste it into
   `CLIENT_ID` in `addin/src/auth.js`.
4. **Authentication → Add a platform → Single-page application**, and add
   both redirect URIs:
   - `brk-multihub://<your-addin-domain>` — e.g.
     `brk-multihub://addin.pigeonhole.email` (or
     `brk-multihub://localhost:3000` for dev). This enables Nested App
     Authentication inside Outlook.
   - `https://<your-addin-domain>/src/taskpane.html` — popup fallback.
5. **API permissions → Add a permission → Microsoft Graph → Delegated**:
   - `Mail.ReadWrite` (read folders/messages, move, mark read)
   - `MailboxSettings.ReadWrite` (create inbox rules)
   - `User.Read`

   No admin consent needed for personal mailboxes; org admins may need to
   grant consent once for tenant-wide use.

## 2. Host the add-in

The add-in is static files — any HTTPS static host works (GitHub Pages,
Cloudflare Pages, Azure Static Web Apps, S3+CloudFront). Upload the
`addin/` directory, then update every URL in `manifest.xml` from
`https://addin.pigeonhole.email` to your host.

For local development instead:

```bash
cd addin
npm install
npm run dev-certs   # installs trusted localhost certificates
npm run dev         # https://localhost:3000
```

and point the manifest at `https://localhost:3000`.

## 3. Sideload in Outlook

- **Outlook on the web / new Outlook:** Settings gear → **Manage add-ins**
  (or <https://aka.ms/olksideload>) → **My add-ins** → **Add a custom
  add-in → Add from file** → pick `manifest.xml`.
- **Classic Outlook for Windows:** same dialog via **Home → All Apps →
  Get Add-ins → My add-ins**; the add-in syncs to desktop automatically
  once added to the mailbox.

Validate the manifest anytime with `npm run validate`.

## 4. First run

Open any message → ribbon → **File with Pigeonhole** → pin the pane
(pushpin icon in its corner) → **Train on my folders**. Training needs to
finish once; after that, suggestions appear instantly for every message
you select, and each filing you confirm refines the model.

## 5. Selling licenses

The website (`website/index.html`) is a static page — deploy anywhere and
wire the **Buy** button to a payment link (Stripe Payment Links, Paddle,
or Lemon Squeezy are all fine for $30/year subscriptions; Paddle and Lemon
Squeezy act as merchant of record and handle sales tax for you).

In the payment provider's webhook (or even manually, at low volume),
generate the buyer's key and email it:

```bash
node scripts/make-license-key.js buyer@example.com   # expires in 1 year
```

Keys validate offline inside the add-in — bound to the buyer's email and
expiry date. **Change `VENDOR_SECRET`** in both `scripts/make-license-key.js`
and `addin/src/license.js` (keep them identical) before selling anything.

## 6. Publishing to AppSource (optional)

Sideloading is fine for personal use and small teams. For public
distribution, submit the manifest via Partner Center
(<https://learn.microsoft.com/office/dev/store/submit-to-appsource-via-partner-center>).
AppSource requires the hosted URLs to be stable and HTTPS, a privacy policy
URL, and support URL — `website/index.html` anchors (`#privacy`, `#faq`)
can serve as those pages, or split them into standalone pages.
