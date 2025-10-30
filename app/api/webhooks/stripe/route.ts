import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/billing/stripe";
import { prisma } from "@/lib/prisma";
import { grantCredits } from "@/lib/credits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const sig = req.headers.get("stripe-signature") ?? "";
  const raw = await req.text();

  console.log(`[WEBHOOK] Received Stripe webhook event`);

  let event: any;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET ?? "");
    console.log(`[WEBHOOK] Event verified: ${event.type} (${event.id})`);
  } catch (err: any) {
    console.error(`[WEBHOOK] Event verification failed:`, err.message);
    return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
  }

  // Idempotency: skip if we already processed
  const exists = await prisma.billingEventLog.findUnique({ where: { eventId: event.id } });
  if (exists) {
    console.log(`[WEBHOOK] Event ${event.id} already processed, skipping`);
    return NextResponse.json({ ok: true, idempotent: true });
  }

  await prisma.billingEventLog.create({ data: { eventId: event.id, type: event.type, payloadMinimal: { id: event.id, type: event.type } as any } });
  console.log(`[WEBHOOK] Event ${event.id} logged for processing`);

  try {
    if (["invoice.paid", "invoice.payment_succeeded", "invoice_payment.paid"].includes(event.type)) {
      console.log(`[WEBHOOK] Processing invoice.paid event`);
      console.log("Event:", event);
      const invoice = event.data.object;
      
      // Check if this is a subscription invoice
      if (!invoice.subscription) {
        console.log(`[WEBHOOK] Invoice ${invoice.id} is not a subscription invoice, skipping`);
        return NextResponse.json({ ok: true });
      }
      
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
      const customerId = subscription.customer as string;
      
      console.log(`[WEBHOOK] Invoice details:`, {
        invoiceId: invoice.id,
        subscriptionId: subscription.id,
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
        const metadata = user.metadata as any;
        console.log(`[WEBHOOK] User metadata:`, metadata);
        if (metadata.lastCheckoutPlan) {
          planType = (metadata.lastCheckoutPlan === "Pro" ? "PRO" : "BASIC") as "BASIC" | "PRO";
          creditsToAdd = parseInt(metadata.lastCheckoutCredits || (planType === "PRO" ? "20000" : "10000"));
          console.log(`[WEBHOOK] Using metadata: plan=${planType}, credits=${creditsToAdd}`);
        }
      }

      // Fallback: try to get from Stripe checkout session
      if (!user.metadata || !(user.metadata as any)?.lastCheckoutPlan) {
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
      
      console.log(`[WEBHOOK] Credit calculation:`, {
        currentCredits,
        newCredits: creditsToAdd,
        totalCreditsToAdd,
        planType,
      });
      
      // Update user plan and set total credits
      await prisma.user.update({ 
        where: { id: user.id }, 
        data: { 
          planType, 
          credits: totalCreditsToAdd,
          scrapingFrozen: false, 
          stripeSubscriptionId: subscription.id 
        } 
      });
      
      console.log(`[WEBHOOK] User ${user.id} updated:`, {
        planType,
        credits: totalCreditsToAdd,
        scrapingFrozen: false,
        stripeSubscriptionId: subscription.id,
      });
      
      // Log the credit grant with details
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
          } as any,
        },
      });
      
      console.log(`[WEBHOOK] Credit ledger entry created for user ${user.id}`);
      console.log(`[WEBHOOK] SUCCESS: User ${user.id} upgraded to ${planType}, total credits: ${totalCreditsToAdd} (${creditsToAdd} new + ${currentCredits} remaining)`);
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

      // Get plan from subscription metadata
      const planType = (sub.metadata?.plan === "Pro" ? "PRO" : "BASIC") as "BASIC" | "PRO";
      const prevPlan = user.planType;
      
      await prisma.user.update({ where: { id: user.id }, data: { planType, stripeSubscriptionId: sub.id } });
      console.log(`[WEBHOOK] User ${user.id} plan updated: ${prevPlan} → ${planType}`);
      
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

      await prisma.user.update({ where: { id: user.id }, data: { planType: "FREE", scrapingFrozen: true } });
      console.log(`[WEBHOOK] User ${user.id} downgraded to FREE plan, scraping frozen`);
    }
  } catch (err: any) {
    console.error("[stripe webhook] handler error", err?.message);
  }

  return NextResponse.json({ ok: true });
}


