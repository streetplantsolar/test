# Pigeonhole — architecture

## Design constraints

1. **100% private** — no Pigeonhole backend, no telemetry, no third-party
   AI. The only network peer is Microsoft Graph, under the user's own
   OAuth sign-in.
2. **Fast training** — hard requirement < 10 minutes; target < 2 minutes.
3. **Instant suggestions** — ranking must feel synchronous as the user
   arrows through the inbox with the pane pinned.
4. **Zero marginal cost** — no per-message tokens, works offline once
   trained.

These rule out LLMs and rule in a classical text classifier. Folder
prediction is a well-behaved supervised problem: the user's own mailbox is
a large, perfectly labeled training set (every filed message is a label).

## The classifier (`classifier.js`)

Multinomial Naive Bayes with Laplace smoothing over namespaced lexical
features:

| namespace | source | weight | why |
|---|---|---|---|
| `from:` | full sender address | ×6 | strongest routing signal |
| `dom:` / `dom2:` | sender domain / 2nd-level domain | ×3 / ×2 | generalizes across people at one org |
| `lp:` | sender local-part tokens | ×1 | catches `noreply`, `billing`, plus-tags |
| `name:` | sender display-name tokens | ×2 | survives address changes |
| `subj:` | subject tokens (Re:/Fwd: stripped, stopworded) | ×1 | project names, topics |
| `to:` / `cc:` | recipient addresses | ×1 | which alias/list the mail came through |

Weights are expressed by token repetition, which keeps the model a plain
`{token: count}` map — trivially JSON-serialized to `localStorage`.

Notes:

- **Bodies are never read.** Metadata is enough for folder routing and
  keeps both training fast and the privacy story absolute.
- Priors come from folder message counts, so busy folders rank higher on
  genuinely ambiguous messages.
- Singleton subject/name tokens are pruned after training (identity
  features are always kept — one prior email from a sender is meaningful).
  This keeps models to a few hundred KB even for large mailboxes.
- Scores are softmax-normalized for the confidence bars in the UI.
- `learnOne()` does incremental updates on every user-confirmed filing, so
  the model tracks new projects without retraining.

Measured on the synthetic 12-folder / 480-message fixture
(`scripts/test-classifier.js`): training 8 ms, ranking < 0.05 ms/message,
100% top-1 on held-out messages.

## Training pipeline (`graph.js`)

```
listAllFolders()      BFS over /me/mailFolders (+childFolders), paged 200/page
   └─ trainableFolders()   drop well-known system folders (Sent, Drafts,
                           Junk, Deleted, …) and empty folders
sampleMessages()      per folder: GET /messages?$top=50
                      &$select=subject,sender,toRecipients,ccRecipients
                      — sent as JSON $batch requests, 20 per batch
train()               one pass over samples → model → localStorage
```

`$select` keeps payloads tiny (no bodies), and `$batch` cuts round-trips
20×. A 100-folder mailbox is ~5 batch calls for folder listing plus 5 for
sampling ≈ seconds-to-a-minute of wall time, dominated by network. 429/503
responses honor `Retry-After` with capped retries.

## Suggestion & filing flow (`app.js`)

- The taskpane is **pinnable** (`SupportsPinning`); an `ItemChanged`
  handler re-ranks on every selection. Ranking uses only Office.js item
  properties (sender, subject, to, cc) — no network call to show
  suggestions.
- Filing: `item.itemId` → `convertToRestId()` → Graph
  `PATCH /messages/{id}` (`isRead: true`) then `POST /messages/{id}/move`.
- Ranks 1–5 render immediately; **Other folders** expands ranks 6–10.
- The ⚡ button posts to `/me/mailFolders/inbox/messageRules` with
  `senderContains` + `moveToFolder` + `markAsRead` +
  `stopProcessingRules` — a real server-side rule that runs even with
  Outlook closed, created in one click.

## Auth (`auth.js`)

MSAL.js v3 with **Nested App Authentication** (NAA) —
`createNestablePublicClientApplication` — Microsoft's current guidance for
Outlook add-ins. It brokers tokens through the host Outlook client, works
in classic desktop / new Outlook / web, and needs no token-exchange
backend (which a "no server" product can't have). Hosts without NAA fall
back to a standard MSAL popup. Legacy Exchange user-identity tokens are
deliberately not used (Microsoft is retiring them).

## Trial & licensing (`license.js`)

Local-only trial clock (7 days from first launch) and offline-verifiable
keys: `PGNH-<emailhash+expiry>-<checksum>`, FNV-1a with a vendor secret.
This is deliberate "good-enough" DRM for a $30 utility — it deters casual
sharing without adding an activation server that would break the privacy
promise.

## Portability

`classifier.js` is a UMD module with no Office/DOM dependencies (unit
tests run it in Node). A Gmail port needs only: Gmail API equivalents of
`graph.js` (labels ≈ folders, `users.messages.list/modify`), and a small
container (Chrome extension or Workspace add-on). The model format and UI
carry over unchanged.
