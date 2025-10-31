# Subscription Flow Verification

## Complete Subscription Flow

### 1. Initial Subscription (New User)

**Flow:**
1. User clicks "Subscribe" → `/api/billing/checkout` creates Stripe Checkout Session
2. User completes payment → Stripe events fire in this order:
   - `checkout.session.completed` → Sets subscription dates immediately
   - `customer.subscription.created` → Sets subscription dates (backup)
   - `invoice.paid` → Grants credits, updates plan, ensures dates are set

**What gets stored:**
- `stripeCustomerId`: Created/verified in checkout
- `stripeSubscriptionId`: Set in checkout.session.completed or customer.subscription.created
- `subscriptionStartDate`: Set from subscription.current_period_start
- `subscriptionEndDate`: Set from subscription.current_period_end
- `planType`: Set to BASIC or PRO in invoice.paid
- `credits`: Grant = newCredits + existingCredits (rollover)

### 2. Monthly Renewal

**Flow:**
1. Stripe automatically charges customer monthly
2. `invoice.paid` fires → Grants credits, updates subscription dates
3. Dates are updated from invoice.period_start/period_end or subscription object

### 3. Upgrade (Basic → Pro)

**Flow:**
1. User clicks "Upgrade to Pro" → `/api/billing/checkout`
2. If Basic subscription exists → In-place upgrade via subscription.update
3. Otherwise → Creates new Pro checkout session
4. `customer.subscription.updated` fires → Updates plan and dates
5. `invoice.paid` fires → Grants Pro credits

**Important:**
- Previous Basic subscription is canceled before Pro upgrade
- Credits rollover: existing credits + new Pro credits

### 4. Cancellation

**Flow:**
1. User clicks "Cancel Subscription" → `/api/billing/cancel`
2. Cancellation reason stored in `SubscriptionCancellation` table
3. Stripe subscription cancelled
4. User DB updated: `planType = FREE`, `credits = 0`, `subscriptionId = null`, dates cleared
5. `customer.subscription.deleted` webhook fires → Confirms cancellation

### 5. Scheduled Downgrade (Pro → Basic)

**Flow:**
1. User clicks "Schedule downgrade" → `/api/billing/downgrade-schedule`
2. Stripe sets `cancel_at_period_end = true` on Pro subscription
3. User metadata updated: `downgradeScheduled = true`, `downgradeTarget = "BASIC"`
4. On renewal end: `customer.subscription.deleted` fires
5. Webhook creates new Basic subscription automatically
6. `invoice.paid` fires for Basic → Grants Basic credits

### 6. Credit Deduction (PDF Upload)

**Flow:**
1. User uploads PDF → Client pre-checks credits (must be >= 100)
2. Server-side check in `/api/extract-resume` → Returns 402 if insufficient
3. After successful extraction → `debitCreditsForResume()` called
4. 100 credits deducted from user account
5. Credit ledger entry created

## Webhook Event Handlers

### `checkout.session.completed`
- Sets `stripeSubscriptionId` and subscription dates
- Early capture of dates (before invoice)

### `customer.subscription.created`
- Sets `stripeSubscriptionId` and subscription dates
- Backup handler (in case checkout.session.completed fails)

### `invoice.paid`
- **Primary handler for credits and plan**
- Grants credits: newCredits + existingCredits (rollover)
- Updates `planType`, `credits`, `scrapingFrozen`
- Ensures subscription dates are set (triple-check)
- Creates credit ledger entry

### `customer.subscription.updated`
- Updates subscription dates
- Updates plan if changed
- Grants credits if upgrading to Pro

### `customer.subscription.deleted`
- If scheduled downgrade → Creates Basic subscription
- Otherwise → Sets user to FREE, clears dates

## Date Setting Priority

1. Invoice period dates (`invoice.period_start`, `invoice.period_end`)
2. Subscription object dates (`subscription.current_period_start`, `subscription.current_period_end`)
3. Retrieval from subscription if dates missing

## Idempotency

- **Event Level**: `BillingEventLog` prevents duplicate event processing
- **Credit Ledger**: Unique constraint `[userId, reason, resumeId]` + error handling
- **Safe to retry**: All webhook handlers are idempotent

## Error Handling

- All Stripe API calls wrapped in try-catch
- Graceful handling of missing data
- Comprehensive logging for debugging
- Duplicate entries handled gracefully

## Data Consistency

- Transactional credit operations
- Rollback on errors
- Multiple date sources with fallbacks
- Clear separation of concerns (credits vs dates)

