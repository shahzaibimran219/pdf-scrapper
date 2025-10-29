# Plan — Stripe Subscription & Credits Extension (for Plan v2)

> Optional extension to demonstrate end‑to‑end SaaS billing. Integrates **Stripe Subscriptions** and a **credit system** directly into the PDF scraping workflow from Plan v2. All billing runs in **Stripe Test Mode** only.

---

## 0) Objectives

- Add **subscription-based credits** with Stripe: **Basic ($10 → +10,000 credits)** and **Pro ($20 → +20,000 credits)**.
- Gate the core **extraction** flow by **credits**: **1 extraction = 100 credits**; deduct after successful extraction.
- Provide **/settings → Subscription** UI for subscribe/upgrade/manage billing.
- Handle **webhooks** to activate plans, grant credits, adjust plan state, and **freeze scraping** when canceled.
- Maintain **idempotent** and **auditable** credit accounting via a **ledger**.

---

## 1) Environment Variables (`.env.example`)

> All operations must run in **Test Mode**. Enforce at startup.

```
STRIPE_SECRET_KEY=         # must start with sk_test_*
STRIPE_PUBLIC_KEY=         # pk_test_*
STRIPE_WEBHOOK_SECRET=     # whsec_*
STRIPE_PRICE_BASIC=        # price_* (Basic plan price id)
STRIPE_PRICE_PRO=          # price_* (Pro plan price id)
```

**Startup assertion:** refuse to boot (or hard-warn) if `STRIPE_SECRET_KEY` does not start with `sk_test_`.

---

## 2) Data Model Changes (Prisma / Supabase)

### `User` additions

- `planType` — enum: `FREE | BASIC | PRO` (default `FREE`)
- `credits` — `INT` (default `0`)
- `scrapingFrozen` — `BOOLEAN` (default `false`)
- `stripeCustomerId` — `TEXT` (nullable)
- `stripeSubscriptionId` — `TEXT` (nullable)
- `stripePriceId` — `TEXT` (nullable)

### New table: `CreditLedger`

Auditable, idempotent record of all credit changes.

- `id` (UUID, PK)
- `userId` (FK → `User`)
- `delta` (`INT`) — positive grants, negative debits
- `reason` (`TEXT` or enum): `SUBSCRIPTION_GRANT | EXTRACTION_DEBIT | PLAN_CHANGE | MANUAL_ADJUST | REFUND | CORRECTION`
- `meta` (`JSONB`) — `{ stripeEventId?, priceId?, resumeId?, jobId? }`
- `createdAt` (`TIMESTAMP` default now)

**Index/constraint suggestions:**

- `idx_ledger_user_createdAt (userId, createdAt)`
- **Uniqueness** to prevent double debit: unique partial index on `(userId, reason, (meta->>'resumeId')) WHERE reason='EXTRACTION_DEBIT'`

### Optional: `BillingEventLog`

- `eventId` (PK), `type`, `payloadMinimal JSONB`, `createdAt`
- Used for webhook **idempotency** and debugging.

### RLS

- Extend existing **Row Level Security** so users can only access their own ledger rows. Admin-only access to `BillingEventLog`.

---

## 3) Stripe Setup (Test Mode)

- Create **Product + Prices** in Stripe Dashboard:
  - Product: `Basic` → **price** = `STRIPE_PRICE_BASIC` (recurring, $10 test)
  - Product: `Pro` → **price** = `STRIPE_PRICE_PRO` (recurring, $20 test)
- **Client SDK:** `@stripe/stripe-js`
- **Server SDK:** `stripe` (Node)
- **Webhook endpoint:** `/api/webhooks/stripe` (App Router **Node runtime**). Use **raw body** for signature verification.

**Price allow‑list:** map only `STRIPE_PRICE_BASIC` and `STRIPE_PRICE_PRO` → `{ planType, grant }`.

---

## 4) Credit Logic (Integration Contract)

- **1 extraction = 100 credits**.
- **Before** calling OpenAI: check `!scrapingFrozen && credits >= 100`.
- **After** successful extraction: **debit 100** credits atomically.
- If **insufficient credits**: deny and show a friendly toast suggesting subscribe/upgrade.
- **Ledger invariant:** `users.credits == SUM(CreditLedger.delta)` across all rows for the user. Enforce in code paths that mutate credits.

---

## 5) Subscription Plans & Upgrades

- **Basic**: grant **+10,000** credits on activation (and on each paid invoice). Set `planType=BASIC`.
- **Pro**: grant **+20,000** credits on activation (and on each paid invoice). Set `planType=PRO`.
- **Upgrade flow** (Basic → Pro):
  - On successful payment: `planType=PRO` and **add +20,000** credits (as per requirement).
  - Show success toast after confirmation (landing on `/settings` `success_url`).

> The spec doesn’t require credit clawback on downgrade; we **do not** remove credits already granted.

---

## 6) API Endpoints

### `POST /api/billing/checkout`  (Auth required)

- Body: `{ plan: "BASIC" | "PRO" }`
- Ensure/create `stripeCustomerId`.
- Create **Checkout Session** (mode=`subscription`, allow‑listed price).
- Return `sessionUrl` for client redirect.

### `POST /api/billing/portal`  (Auth required)

- Create Stripe **Customer Portal** session for the authenticated user.
- Return `url` to redirect for billing management.

### `POST /api/webhooks/stripe`  (No auth; signature verified)

- Read **raw body** via `await req.text()`.
- Verify with `STRIPE_WEBHOOK_SECRET`.
- **Idempotent** apply of events (check `BillingEventLog.eventId`).

**Events & actions**

- `invoice.paid` → **activate** subscription, set `planType` from price, `scrapingFrozen=false`, **grant credits** (+10k Basic / +20k Pro).
- `customer.subscription.updated` → handle plan changes:
  - Upgrade to Pro → `planType=PRO` and **grant +20k** (per requirement).
  - Downgrade to Basic → `planType=BASIC` (no credit removal).
- `customer.subscription.deleted` → set `planType=FREE`, `scrapingFrozen=true` (**freeze scraping**).

> Log all events (minimal payload) for debugging; never store full PII.

---

## 7) Scraper Integration (Plan v2 hook points)

**Where:** in both small-file server action and `/api/extract` endpoint (sync and async modes).

1) **Pre‑check** (Transaction):

   - Lock user row (or `SELECT … FOR UPDATE`) to prevent race.
   - If `scrapingFrozen` → deny (toast: “Subscription inactive; please reactivate.”).
   - If `credits < 100` → deny (toast: “Not enough credits (100 required). Upgrade or top up.”).

2) **Run extraction** (existing pipeline).

3) **Post‑success debit** (Transaction):

   - `credits = credits - 100` (guard against negative) and write `CreditLedger`:
     - `{ delta: -100, reason: "EXTRACTION_DEBIT", meta: { resumeId, jobId } }`
     - Ensure **uniqueness** by `(userId, reason, meta.resumeId)`.

4) **Failure path**: no debit; optionally log reason.

---

## 8) Settings UI (`/settings` → Subscription)

- Show **current plan** and **remaining credits**.
- Buttons:
  - “Subscribe to Basic Plan” → call `/api/billing/checkout` with `BASIC`, redirect to `sessionUrl`
  - “Upgrade to Pro Plan” → call `/api/billing/checkout` with `PRO`
  - “Manage Billing” → call `/api/billing/portal`, redirect to portal
- **Loading** states for each button; **toasts** for success/failure.
- On return (`success_url=/settings?checkout=success`), fetch server state and show success toast.

---

## 9) Security & Reliability

- **Test Mode only**: assert `sk_test_` key; never accept live keys.
- **Signature verification** on webhooks; return 2xx quickly.
- **Price allow‑list**: reject unknown prices.
- **Transactions + row locks** for debits; no negative balances.
- **Idempotency**:
  - Webhooks: `BillingEventLog.eventId` guard.
  - Debits: unique `(userId, reason, resumeId)` index.
- **Least PII**: store only necessary stripe ids; scrub logs.
- **Observability**: Sentry spans around billing/webhooks and scraper credit paths.

---

## 10) Testing Strategy

- **Unit**
  - Price→plan mapping and grant amounts
  - Ledger delta application; invariant enforcement; negative balance prevention
- **Integration**
  - Checkout and Portal session creation
  - Webhook handlers for `invoice.paid`, `subscription.updated`, `subscription.deleted`
  - End‑to‑end: subscribe → credits granted → run extraction → credits −100
  - Duplicate webhook idempotency
  - Parallel extraction with exactly 100 credits → only one succeeds
- **E2E (Playwright)**
  - Settings: subscribe/upgrade/manage flows, toasts, loading states
  - Upload blocked on insufficient credits or frozen subscription
  - Upload allowed when active & credits ≥ 100

---

## 11) Migration & Rollout Steps

1) **DB migration**: add user columns, create `CreditLedger` (and `BillingEventLog`), add indexes/uniques.

2) **Stripe dashboard**: create products/prices (Test mode), copy `price_*` ids.

3) **Env**: set Stripe keys and prices; deploy with Test keys only.

4) **API**: deploy `/api/billing/checkout`, `/api/billing/portal`, `/api/webhooks/stripe`.

5) **UI**: add `/settings` Subscription section (plan & credits display; buttons).

6) **Scraper guards**: enforce `!scrapingFrozen` & `credits >= 100` pre‑extraction; debit after success.

7) **Run tests**; simulate webhooks via Stripe CLI; verify idempotency & race safety.

8) **Monitor** via Sentry; adjust logging levels; document operator playbooks.

---

## 12) Developer Notes & Choices

- **Grant on `invoice.paid`** (canonical), not on `checkout.session.completed`. The latter may fire pre‑payment; use only for UI hints if needed.  
- **Downgrade without clawback**: credits already granted remain.  
- **Freeze on cancel**: per requirement, `subscription.deleted` freezes scraping regardless of remaining credits.  
- **Allow‑list prices**: prevents attaching arbitrary prices at checkout or via webhooks.  
- **Auditable ledger**: all balance changes flow through `CreditLedger`, keeping `users.credits` as a denormalized convenience.

---

## 13) API Shapes (sketch)

**Checkout**

```ts
POST /api/billing/checkout
{ plan: "BASIC" | "PRO" }
→ { sessionUrl: string }
```

**Portal**

```ts
POST /api/billing/portal
{} → { url: string }
```

**Webhook**

```ts
POST /api/webhooks/stripe
// raw body, verify signature
// handles: invoice.paid, customer.subscription.updated, customer.subscription.deleted
// returns 2xx always after idempotent processing
```

---

## 14) UI States (Settings → Subscription)

- **Idle**: shows plan, credits, three buttons
- **Loading**: button-level spinners (creating session/portal)
- **Toast: success**: after returning from checkout
- **Toast: error**: network or Stripe API failure

---

## 15) To‑Dos — Fully Detailed (Delivery‑Ready)

> Append these to the end of your Plan v2 doc or track as issues. Each is small, testable, and mapped to this extension.

### Phase A — DB & Schema

- [ ] Add columns to `User`: `planType`, `credits`, `scrapingFrozen`, `stripeCustomerId`, `stripeSubscriptionId`, `stripePriceId`
- [ ] Create `CreditLedger` with indexes and **unique** `(userId, reason, meta->>'resumeId')` for `EXTRACTION_DEBIT`
- [ ] Create `BillingEventLog` for webhook idempotency (optional but recommended)
- [ ] Extend **RLS** to cover `CreditLedger` (owner-only)

### Phase B — Stripe & Env

- [ ] Create Stripe **Products/Prices** (Basic $10, Pro $20) in **Test Mode**
- [ ] Add `.env.example` keys: `STRIPE_SECRET_KEY`, `STRIPE_PUBLIC_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_BASIC`, `STRIPE_PRICE_PRO`
- [ ] Add startup assertion that `STRIPE_SECRET_KEY` starts with `sk_test_`

### Phase C — Billing APIs

- [ ] Implement `POST /api/billing/checkout` (allow‑listed prices, create customer if needed)
- [ ] Implement `POST /api/billing/portal` (create portal session)
- [ ] Implement `POST /api/webhooks/stripe` with **raw body** + signature verification
  - [ ] Handle `invoice.paid`: set plan, `scrapingFrozen=false`, **grant credits** (+10k/+20k), log event
  - [ ] Handle `customer.subscription.updated`: set plan; on upgrade → **+20k**; log event
  - [ ] Handle `customer.subscription.deleted`: set `planType=FREE`, `scrapingFrozen=true`; log event
  - [ ] Store `eventId` in `BillingEventLog` to prevent reprocessing

### Phase D — Credits Engine

- [ ] Implement `grantCredits(userId, amount, meta)` helper (updates `users.credits` + ledger insert)
- [ ] Implement transactional **debit** on success: `-100` with ledger, uniqueness by `resumeId`
- [ ] Add invariant check: recalc SUM(ledger) when discrepancies are detected (dev only)

### Phase E — Scraper Integration

- [ ] Pre‑extraction guard: deny if `scrapingFrozen` or `credits < 100` (toasts)
- [ ] Post‑success debit: transactional `-100` with `EXTRACTION_DEBIT` ledger row
- [ ] Ensure async jobs also honor guards and debit correctly

### Phase F — Settings UI

- [ ] `/settings` → Subscription card: plan & credits
- [ ] Buttons: **Subscribe Basic**, **Upgrade to Pro**, **Manage Billing**
- [ ] Loading states; toasts for success/failure
- [ ] `success_url` landing handler (refresh state, success toast)

### Phase G — Observability & Security

- [ ] Sentry spans for billing routes and scraper debit path
- [ ] Structured logs: `{ requestId, userId, stripeEventId, priceId, subscriptionId }`
- [ ] Least PII: stored ids only; scrub logs
- [ ] Price allow‑list enforcement in both checkout and webhook handlers

### Phase H — Testing

- **Unit**
  - [ ] Price→plan mapping; grant amounts
  - [ ] Ledger operations; prevent negative balances
- **Integration**
  - [ ] Checkout + Portal sessions
  - [ ] Webhooks: `invoice.paid` (grant), `subscription.updated` (upgrade/downgrade), `subscription.deleted` (freeze)
  - [ ] End‑to‑end: subscribe → grant → extract → debit 100
  - [ ] Idempotency: duplicate webhook ignored
  - [ ] Race: two extractions with 100 credits → only one debits
- **E2E (Playwright)**
  - [ ] Settings flows and toasts
  - [ ] Upload blocked on insufficient credits / frozen
  - [ ] Upload allowed when active and credits sufficient

### Phase I — Docs & Rollout

- [ ] Update README: “Billing & Credits” (sequence diagrams for checkout/webhooks; freeze semantics)
- [ ] Add FAQ (Test Mode only; upgrade grants; no clawback on downgrade)
- [ ] Add OPERATIONS.md (webhook replay, Stripe CLI usage, common failures)

---

**End of plan.**