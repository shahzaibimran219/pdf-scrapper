import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/billing/stripe";
import { prisma } from "@/lib/prisma";
import { grantCredits } from "@/lib/credits";
import { Prisma } from "@prisma/client";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const sig = req.headers.get("stripe-signature") ?? "";
  const raw = await req.text();

  console.log(`[WEBHOOK] Received Stripe webhook event`);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET ?? "");
    console.log(`[WEBHOOK] Event verified: ${event.type} (${event.id})`);
  } catch (err: unknown) {
    const message = typeof err === 'object' && err && 'message' in err ? String((err as Record<string, unknown>).message) : 'Unknown error';
    console.error(`[WEBHOOK] Event verification failed:`, message);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  // Idempotency: attempt to log; if duplicate, skip processing
  try {
    await prisma.billingEventLog.create({ 
      data: { 
        eventId: event.id, 
        type: event.type, 
        payloadMinimal: { id: event.id, type: event.type } as Prisma.InputJsonValue 
      } 
    });
    console.log(`[WEBHOOK] Event ${event.id} logged for processing`);
  } catch (e: unknown) {
    const errorCode = typeof e === 'object' && e && 'code' in e ? String((e as Record<string, unknown>).code) : undefined;
    if (errorCode === 'P2002') {
      console.log(`[WEBHOOK] Event ${event.id} already processed (unique), skipping`);
      return NextResponse.json({ ok: true, idempotent: true });
    }
    throw e;
  }

  try {
    // if (["invoice.paid", "invoice.payment_succeeded", "invoice_payment.paid"].includes(event.type)) {
      if (event.type === "invoice.paid") {  
      console.log(`[WEBHOOK] Processing invoice.paid event`);
      console.log("Event:", event);
      let invoice: Stripe.Invoice = event.data.object as Stripe.Invoice;
      // Support the new invoice_payment.paid payload which references an invoice id
      const invoiceData = event.data.object as Stripe.Invoice | { object: string; invoice?: string };
      if (invoiceData?.object === "invoice_payment" && 'invoice' in invoiceData && invoiceData.invoice) {
        try {
          const fetched = await stripe.invoices.retrieve(invoiceData.invoice as string);
          invoice = fetched;
        } catch {
          console.warn(`[WEBHOOK] Could not fetch invoice ${invoiceData.invoice} from invoice_payment, skipping`);
          return NextResponse.json({ ok: true });
        }
      }
      
      // Resolve subscription/customer robustly across API variants
      const invoiceWithSub = invoice as Stripe.Invoice & { subscription_exposed_id?: string; subscription?: string | Stripe.Subscription | null };
      const subscriptionValue = 'subscription' in invoiceWithSub ? invoiceWithSub.subscription : null;
      let subscriptionId: string | null = (typeof subscriptionValue === 'string' ? subscriptionValue : null) ?? invoiceWithSub.subscription_exposed_id ?? null;
      let customerId: string | null = (typeof invoiceWithSub.customer === 'string' ? invoiceWithSub.customer : null);

      // If missing invoice, try to backfill via Stripe
      if (!customerId && subscriptionId) {
        try {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          customerId = (sub.customer as string) ?? null;
        } catch {}
      }
      if (customerId && !subscriptionId) {
        try {
          const subs = await stripe.subscriptions.list({ customer: customerId, limit: 1 });
          subscriptionId = subs.data[0]?.id ?? null;
        } catch {}
      }
      if (!customerId) {
        console.log(`[WEBHOOK] Invoice ${invoice.id} has no customer reference; skipping`);
        return NextResponse.json({ ok: true });
      }
      
      console.log(`[WEBHOOK] Invoice details:`, {
        invoiceId: invoice.id,
        subscriptionId,
        customerId,
        amount: invoice.amount_paid,
        currency: invoice.currency,
      });

      const user = await prisma.user.findFirst({ where: { stripeCustomerId: customerId } });
      if (!user) {
        console.warn(`[WEBHOOK] No user found for customer ${customerId}`);
        return NextResponse.json({ ok: true });
      }

      console.log(`[WEBHOOK] Found user ${user.id} for customer ${customerId}`, {
        currentPlan: user.planType,
        currentCredits: user.credits,
        hasMetadata: !!user.metadata,
      });

      // Get plan and credits from user's stored checkout metadata
      let planType: "BASIC" | "PRO" = "BASIC";
      let creditsToAdd = 10000;

      if (user.metadata) {
        const metadata = user.metadata as Record<string, unknown>;
        console.log(`[WEBHOOK] User metadata:`, metadata);
        if (metadata.lastCheckoutPlan && typeof metadata.lastCheckoutPlan === 'string') {
          planType = (metadata.lastCheckoutPlan === "Pro" ? "PRO" : "BASIC") as "BASIC" | "PRO";
          const creditsStr = typeof metadata.lastCheckoutCredits === 'string' ? metadata.lastCheckoutCredits : (planType === "PRO" ? "20000" : "10000");
          creditsToAdd = parseInt(creditsStr, 10);
          console.log(`[WEBHOOK] Using metadata: plan=${planType}, credits=${creditsToAdd}`);
        }
      }

      // Fallback: try to get from Stripe checkout session
      const metadataCheck = user.metadata as Record<string, unknown> | null;
      if (!metadataCheck || !metadataCheck.lastCheckoutPlan) {
        console.log(`[WEBHOOK] No metadata found, trying Stripe checkout session lookup`);
        try {
          // Get the most recent checkout session for this customer
          const sessions = await stripe.checkout.sessions.list({
            customer: customerId,
            limit: 1,
          });
          
          if (sessions.data.length > 0) {
            const checkoutSession = sessions.data[0];
            console.log(`[WEBHOOK] Found checkout session:`, {
              sessionId: checkoutSession.id,
              metadata: checkoutSession.metadata,
            });
            if (checkoutSession.metadata?.plan) {
              planType = (checkoutSession.metadata.plan === "Pro" ? "PRO" : "BASIC") as "BASIC" | "PRO";
              creditsToAdd = parseInt(checkoutSession.metadata.credits || (planType === "PRO" ? "20000" : "10000"));
              console.log(`[WEBHOOK] Using checkout session: plan=${planType}, credits=${creditsToAdd}`);
            }
          }
        } catch (e) {
          console.warn(`[WEBHOOK] Could not retrieve checkout session:`, e);
        }
      }
      
      // Calculate total credits: new subscription credits + any remaining credits
      const currentCredits = user.credits || 0;
      const totalCreditsToAdd = creditsToAdd + Math.max(0, currentCredits);
      
      // Get subscription dates from subscription object (most accurate source)
      let subscriptionStartDate: Date | null = null;
      let subscriptionEndDate: Date | null = null;
      
      // Always try to get dates from subscription object first (most accurate)
      if (subscriptionId) {
        try {
          const subResponse = await stripe.subscriptions.retrieve(subscriptionId);
          // Handle Stripe.Response wrapper if needed
          const subRaw = 'data' in subResponse ? (subResponse as unknown as { data: Stripe.Subscription }).data : subResponse as Stripe.Subscription;
          // Type assertion for period properties which exist but may not be in type definition
          const sub = subRaw as Stripe.Subscription & { current_period_start?: number; current_period_end?: number };
          const periodStart = sub.current_period_start;
          const periodEnd = sub.current_period_end;
          console.log(`[WEBHOOK] Retrieved subscription ${subscriptionId}:`, {
            current_period_start: periodStart,
            current_period_end: periodEnd,
            status: sub.status,
          });
          if (periodStart && periodEnd) {
            subscriptionStartDate = new Date(periodStart * 1000);
            subscriptionEndDate = new Date(periodEnd * 1000);
            console.log(`[WEBHOOK] Subscription dates from subscription object:`, {
              start: subscriptionStartDate.toISOString(),
              end: subscriptionEndDate.toISOString(),
            });
          } else {
            console.warn(`[WEBHOOK] Subscription ${subscriptionId} missing period dates`);
          }
        } catch (e) {
          console.warn(`[WEBHOOK] Could not retrieve subscription ${subscriptionId} for dates:`, e);
        }
      }
      
      // Fallback: use invoice period if subscription retrieval failed
      if (!subscriptionStartDate || !subscriptionEndDate) {
        if (invoice.period_start && invoice.period_end) {
          // Only use invoice dates if they're different (invoice.paid sometimes has same timestamp)
          const invoiceStart = new Date(invoice.period_start * 1000);
          const invoiceEnd = new Date(invoice.period_end * 1000);
          if (invoiceStart.getTime() !== invoiceEnd.getTime()) {
            subscriptionStartDate = invoiceStart;
            subscriptionEndDate = invoiceEnd;
            console.log(`[WEBHOOK] Subscription dates from invoice (fallback):`, {
              start: subscriptionStartDate.toISOString(),
              end: subscriptionEndDate.toISOString(),
            });
          } else {
            console.warn(`[WEBHOOK] Invoice period dates are identical (likely subscription_create), trying line item period`);
            // Final fallback: invoice line item period usually has correct start/end even on subscription_create
            try {
              const line = invoice.lines?.data?.[0];
              const lp = line?.period;
              if (lp?.start && lp?.end) {
                subscriptionStartDate = new Date(lp.start * 1000);
                subscriptionEndDate = new Date(lp.end * 1000);
                console.log(`[WEBHOOK] Subscription dates from invoice line period:`, {
                  start: subscriptionStartDate.toISOString(),
                  end: subscriptionEndDate.toISOString(),
                });
              }
            } catch {}
          }
        }
      }
      
      console.log(`[WEBHOOK] Credit calculation:`, {
        currentCredits,
        newCredits: creditsToAdd,
        totalCreditsToAdd,
        planType,
      });
      
      // Update user plan and set total credits with subscription dates
      type UserUpdateData = {
        planType: "BASIC" | "PRO";
        credits: number;
        scrapingFrozen: boolean;
        stripeSubscriptionId?: string;
        subscriptionStartDate?: Date;
        subscriptionEndDate?: Date;
        metadata?: Prisma.InputJsonValue;
      };
      
      const updateData: UserUpdateData = {
        planType, 
        credits: totalCreditsToAdd,
        scrapingFrozen: false,
      };
      
      if (subscriptionId) {
        updateData.stripeSubscriptionId = subscriptionId;
      }
      
      // Use dates from earlier extraction if available
      if (subscriptionStartDate) updateData.subscriptionStartDate = subscriptionStartDate;
      if (subscriptionEndDate) updateData.subscriptionEndDate = subscriptionEndDate;
      
      // Clean up checkout metadata after successful subscription activation
      const meta = (user.metadata as Record<string, unknown>) || {};
      if (meta.lastCheckoutSessionId || meta.lastCheckoutPlan || meta.lastCheckoutCredits) {
        delete meta.lastCheckoutSessionId;
        delete meta.lastCheckoutPlan;
        delete meta.lastCheckoutCredits;
        updateData.metadata = meta as Prisma.InputJsonValue;
        console.log(`[WEBHOOK] Cleaned up checkout metadata after successful subscription activation`);
      }
      
      await prisma.user.update({ where: { id: user.id }, data: updateData });
      
      console.log(`[WEBHOOK] User ${user.id} updated:`, {
        planType,
        credits: totalCreditsToAdd,
        scrapingFrozen: false,
        stripeSubscriptionId: subscriptionId,
        subscriptionStartDate: updateData.subscriptionStartDate?.toISOString(),
        subscriptionEndDate: updateData.subscriptionEndDate?.toISOString(),
      });
      
      // Log the credit grant with details (with error handling for idempotency)
      try {
        await prisma.creditLedger.create({
          data: {
            userId: user.id,
            delta: totalCreditsToAdd,
            reason: "SUBSCRIPTION_GRANT",
            resumeId: null,
            meta: {
              planType,
              newCredits: creditsToAdd,
              remainingCredits: currentCredits,
              totalCredits: totalCreditsToAdd,
              eventId: event.id,
            } as Prisma.InputJsonValue,
          },
        });
        console.log(`[WEBHOOK] Credit ledger entry created for user ${user.id}`);
      } catch (e: unknown) {
        // Handle duplicate entry (shouldn't happen due to event idempotency, but be safe)
        const errorCode = typeof e === 'object' && e && 'code' in e ? String((e as Record<string, unknown>).code) : undefined;
        if (errorCode === 'P2002') {
          console.log(`[WEBHOOK] Credit ledger entry already exists for user ${user.id}, skipping`);
        } else {
          console.error(`[WEBHOOK] Failed to create credit ledger entry for user ${user.id}:`, e);
        }
      }
      
      console.log(`[WEBHOOK] SUCCESS: User ${user.id} upgraded to ${planType}, total credits: ${totalCreditsToAdd} (${creditsToAdd} new + ${currentCredits} remaining)`);
    }

    if (event.type === "checkout.session.completed") {
      console.log(`[WEBHOOK] Processing checkout.session.completed event`);
      const session = event.data.object;
      const customerId = session.customer as string;
      
      if (!customerId || session.mode !== "subscription") {
        console.log(`[WEBHOOK] Checkout session not for subscription, skipping`);
        return NextResponse.json({ ok: true });
      }

      const user = await prisma.user.findFirst({ where: { stripeCustomerId: customerId } });
      if (!user) {
        console.warn(`[WEBHOOK] No user found for customer ${customerId} in checkout completion`);
        return NextResponse.json({ ok: true });
      }

      // Get subscription from checkout session
      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null;
      if (subscriptionId) {
        try {
          const subResponse = await stripe.subscriptions.retrieve(subscriptionId);
          // Handle Stripe.Response wrapper if needed
          const subRaw = 'data' in subResponse ? (subResponse as unknown as { data: Stripe.Subscription }).data : subResponse as Stripe.Subscription;
          // Type assertion for period properties
          const sub = subRaw as Stripe.Subscription & { current_period_start?: number; current_period_end?: number };
          type SubUpdateData = {
            stripeSubscriptionId: string;
            subscriptionStartDate?: Date;
            subscriptionEndDate?: Date;
          };
          const updateData: SubUpdateData = { stripeSubscriptionId: subscriptionId };
          
          if (sub.current_period_start && sub.current_period_end) {
            updateData.subscriptionStartDate = new Date(sub.current_period_start * 1000);
            updateData.subscriptionEndDate = new Date(sub.current_period_end * 1000);
          }
          
          await prisma.user.update({ where: { id: user.id }, data: updateData });
          console.log(`[WEBHOOK] User ${user.id} subscription dates set from checkout completion`);
        } catch (e) {
          console.warn(`[WEBHOOK] Could not retrieve subscription ${subscriptionId} from checkout session:`, e);
        }
      }
    }

    if (event.type === "customer.subscription.created") {
      console.log(`[WEBHOOK] Processing customer.subscription.created event`);
      const subObj = event.data.object;
      const sub = subObj as Stripe.Subscription;
      const customerId = typeof sub.customer === 'string' ? sub.customer : null;
      if (!customerId) {
        console.warn(`[WEBHOOK] Subscription created event has no customer ID`);
        return NextResponse.json({ ok: true });
      }
      
      const user = await prisma.user.findFirst({ where: { stripeCustomerId: customerId } });
      
      if (!user) {
        console.warn(`[WEBHOOK] No user found for customer ${customerId} in subscription creation`);
        return NextResponse.json({ ok: true });
      }

      console.log(`[WEBHOOK] Subscription created for user ${user.id}:`, {
        subscriptionId: sub.id,
        status: sub.status,
      });

      // Update subscription dates immediately when subscription is created
      type SubCreateUpdateData = {
        stripeSubscriptionId: string;
        subscriptionStartDate?: Date;
        subscriptionEndDate?: Date;
      };
      const updateData: SubCreateUpdateData = { stripeSubscriptionId: sub.id };
      
      // Access current_period_start and current_period_end safely
      const periodStart = 'current_period_start' in sub ? (sub as { current_period_start?: number }).current_period_start : undefined;
      const periodEnd = 'current_period_end' in sub ? (sub as { current_period_end?: number }).current_period_end : undefined;
      
      if (periodStart && periodEnd) {
        updateData.subscriptionStartDate = new Date(periodStart * 1000);
        updateData.subscriptionEndDate = new Date(periodEnd * 1000);
        console.log(`[WEBHOOK] Set subscription dates on creation:`, {
          start: updateData.subscriptionStartDate.toISOString(),
          end: updateData.subscriptionEndDate.toISOString(),
        });
      }

      await prisma.user.update({ where: { id: user.id }, data: updateData });
      console.log(`[WEBHOOK] User ${user.id} subscription created with dates`);
    }

    if (event.type === "customer.subscription.updated") {
      console.log(`[WEBHOOK] Processing customer.subscription.updated event`);
      const sub = event.data.object;
      const customerId = sub.customer as string;
      const user = await prisma.user.findFirst({ where: { stripeCustomerId: customerId } });
      
      if (!user) {
        console.warn(`[WEBHOOK] No user found for customer ${customerId} in subscription update`);
        return NextResponse.json({ ok: true });
      }

      console.log(`[WEBHOOK] Subscription updated for user ${user.id}:`, {
        subscriptionId: sub.id,
        status: sub.status,
        currentPlan: user.planType,
        metadata: sub.metadata,
      });

      // Get plan from subscription metadata or infer from price
      let planType: "BASIC" | "PRO" | null = null;
      if (sub.metadata?.plan) {
        planType = (sub.metadata.plan === "Pro" ? "PRO" : "BASIC");
      } else {
        try {
          const items = sub.items?.data || [];
          const price = items[0]?.price;
          const amount = price?.unit_amount;
          const productId = typeof price?.product === 'string' ? price.product : null;
          const product = productId ? await stripe.products.retrieve(productId).catch(() => null) : null;
          const productName = product?.name || price?.nickname || "";
          if (amount === 1000 || /basic/i.test(productName)) planType = "BASIC";
          if (amount === 2000 || /pro/i.test(productName)) planType = "PRO";
        } catch {}
      }
      const prevPlan = user.planType;
      type SubUpdateData = {
        stripeSubscriptionId: string;
        planType?: "BASIC" | "PRO";
        subscriptionStartDate?: Date;
        subscriptionEndDate?: Date;
      };
      const updateData: SubUpdateData = { stripeSubscriptionId: sub.id };
      if (planType) updateData.planType = planType;
      
      // Update subscription dates from subscription object
      // Access current_period_start and current_period_end safely
      const periodStart = 'current_period_start' in sub ? (sub as { current_period_start?: number }).current_period_start : undefined;
      const periodEnd = 'current_period_end' in sub ? (sub as { current_period_end?: number }).current_period_end : undefined;
      
      if (periodStart && periodEnd) {
        updateData.subscriptionStartDate = new Date(periodStart * 1000);
        updateData.subscriptionEndDate = new Date(periodEnd * 1000);
        console.log(`[WEBHOOK] Updated subscription dates:`, {
          start: updateData.subscriptionStartDate.toISOString(),
          end: updateData.subscriptionEndDate.toISOString(),
        });
      }

      await prisma.user.update({ where: { id: user.id }, data: updateData });
      console.log(`[WEBHOOK] User ${user.id} plan updated: ${prevPlan} → ${planType ?? prevPlan}`);
      
      // Grant credits if upgrading to Pro
      if (prevPlan !== "PRO" && planType === "PRO") {
        const creditsToAdd = parseInt(sub.metadata?.credits || "20000");
        console.log(`[WEBHOOK] Upgrading to Pro, granting ${creditsToAdd} credits`);
        await grantCredits(user.id, creditsToAdd, { eventId: event.id, planType });
        console.log(`[WEBHOOK] Credits granted to user ${user.id}`);
      }
    }

    if (event.type === "customer.subscription.deleted") {
      console.log(`[WEBHOOK] Processing customer.subscription.deleted event`);
      const sub = event.data.object;
      const customerId = sub.customer as string;
      const user = await prisma.user.findFirst({ where: { stripeCustomerId: customerId } });
      
      if (!user) {
        console.warn(`[WEBHOOK] No user found for customer ${customerId} in subscription deletion`);
        return NextResponse.json({ ok: true });
      }

      console.log(`[WEBHOOK] Subscription deleted for user ${user.id}:`, {
        subscriptionId: sub.id,
        currentPlan: user.planType,
        currentCredits: user.credits,
      });

      // If a downgrade was scheduled, immediately create a Basic subscription
      const meta = (user.metadata as Record<string, unknown>) || {};

      // Guard: if we are upgrading (old sub canceled just before new checkout), do not set FREE
      // Check multiple signals: upgrade flag, recent checkout, or subscription ID mismatch
      const checkoutTimestamp = typeof meta.lastCheckoutTimestamp === 'string' ? new Date(meta.lastCheckoutTimestamp) : null;
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const isRecentCheckout = checkoutTimestamp && checkoutTimestamp > fiveMinutesAgo;
      const hasCheckoutMetadata = meta.lastCheckoutPlan || meta.lastCheckoutSessionId;
      const upgradeFlag = meta.upgradeCheckoutPending || meta.upgradingFromSubscription === sub.id;
      
      // If upgrade flag is set, OR checkout was recent, OR deleted sub doesn't match current sub
      const isReplacingOldSubscription = upgradeFlag || 
                                         (isRecentCheckout && hasCheckoutMetadata) || 
                                         (user.stripeSubscriptionId && user.stripeSubscriptionId !== sub.id && hasCheckoutMetadata);
      
      if (isReplacingOldSubscription) {
        // Clear upgrade flags
        delete meta.upgradeCheckoutPending;
        delete meta.upgradingFromSubscription;
        
        console.log(
          `[WEBHOOK] Upgrade in progress detected; skipping downgrade to FREE on subscription.deleted`,
          { 
            deletedSubscriptionId: sub.id, 
            currentSubscriptionId: user.stripeSubscriptionId,
            lastCheckoutPlan: meta.lastCheckoutPlan,
            checkoutTimestamp: checkoutTimestamp?.toISOString(),
            upgradeFlag,
            isRecentCheckout
          }
        );
        
        // Clear upgrade flags in DB
        await prisma.user.update({
          where: { id: user.id },
          data: { 
            stripeSubscriptionId: null, // Clear old subscription ID
            metadata: meta as Prisma.InputJsonValue 
          }
        });
        
        return NextResponse.json({ ok: true });
      }
      if (meta.downgradeScheduled && meta.downgradeTarget === "BASIC") {
        try {
          // Create a basic monthly price on the fly, then subscribe using price id (type-safe)
          const basicPrice = await stripe.prices.create({
            currency: "usd",
            unit_amount: 1000,
            recurring: { interval: "month" },
            product_data: { name: "Basic Plan - PDF Scraper" },
          });
          const created = await stripe.subscriptions.create({
            customer: customerId,
            items: [
              {
                price: basicPrice.id,
                quantity: 1,
              },
            ],
            proration_behavior: "none",
          });
          console.log(`[WEBHOOK] Created Basic subscription ${created.id} for user ${user.id} as part of scheduled downgrade`);
          // Clear flags and set scrapingFrozen false; planType will flip to BASIC on invoice.paid
          delete meta.downgradeScheduled;
          delete meta.downgradeTarget;
          await prisma.user.update({ where: { id: user.id }, data: { metadata: meta as Prisma.InputJsonValue, scrapingFrozen: false } });
        } catch (e) {
          console.error(`[WEBHOOK] Failed creating Basic subscription during scheduled downgrade for user ${user.id}`, e);
        }
      } else {
        await prisma.user.update({ 
          where: { id: user.id }, 
          data: { 
            planType: "FREE", 
            scrapingFrozen: true,
            subscriptionStartDate: null,
            subscriptionEndDate: null,
          } 
        });
        console.log(`[WEBHOOK] User ${user.id} downgraded to FREE plan, scraping frozen`);
      }
    }
  } catch (err: unknown) {
    const message = typeof err === 'object' && err && 'message' in err ? String((err as Record<string, unknown>).message) : 'Unknown error';
    console.error("[stripe webhook] handler error", message);
  }

  return NextResponse.json({ ok: true });
}


