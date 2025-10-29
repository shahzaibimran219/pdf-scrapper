import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { errorEnvelope } from "@/lib/errors";
import { getStripe } from "@/lib/billing/stripe";
import { getCancelUrl, getSuccessUrl, isBillingEnabled } from "@/lib/billing/env";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.id) return NextResponse.json(errorEnvelope("UNAUTHORIZED", "Auth required"), { status: 401 });
  if (!isBillingEnabled()) return NextResponse.json(errorEnvelope("DISABLED", "Billing not configured"), { status: 400 });

  let body: { plan: "Basic" | "Pro"; amount: number; credits: number };
  try {
    body = await req.json();
    console.log(body);
  } catch {
    return NextResponse.json(errorEnvelope("BAD_REQUEST", "Invalid JSON"), { status: 400 });
  }

  const stripe = getStripe();

  // Ensure stripe customer
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { stripeCustomerId: true, email: true } });
  let customerId = user?.stripeCustomerId ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user?.email ?? undefined });
    customerId = customer.id;
    await prisma.user.update({ where: { id: session.user.id }, data: { stripeCustomerId: customerId } });
  }

  // Create custom checkout session with price_data instead of price ID
  const sessionCheckout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{
      price_data: {
        currency: "usd",
        product_data: {
          name: `${body.plan} Plan - PDF Scraper`,
          description: `${body.credits.toLocaleString()} credits for PDF extraction`,
        },
        unit_amount: body.amount, // Amount in cents
        recurring: {
          interval: "month",
        },
      },
      quantity: 1,
    }],
    success_url: getSuccessUrl(),
    cancel_url: getCancelUrl(),
    allow_promotion_codes: true,
    metadata: {
      plan: body.plan,
      credits: body.credits.toString(),
      userId: session.user.id,
    },
  });

  // Store session ID in user record for webhook lookup
  await prisma.user.update({
    where: { id: session.user.id },
    data: { 
      stripeCustomerId: customerId,
      // Store checkout session metadata for webhook
      metadata: {
        lastCheckoutSessionId: sessionCheckout.id,
        lastCheckoutPlan: body.plan,
        lastCheckoutCredits: body.credits,
      } as any,
    },
  });

  console.log(`[CHECKOUT] User ${session.user.id} initiated ${body.plan} plan checkout:`, {
    userId: session.user.id,
    plan: body.plan,
    amount: body.amount,
    credits: body.credits,
    sessionId: sessionCheckout.id,
    customerId,
    timestamp: new Date().toISOString(),
  });

  return NextResponse.json({ sessionUrl: sessionCheckout.url });
}


