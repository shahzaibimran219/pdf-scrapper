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

  // Ensure we have a DB user and a valid Stripe customer (self-healing)
  const existingById = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, stripeCustomerId: true, planType: true, credits: true },
  });
  const emailFromSession = session.user.email ?? undefined;
  let dbUser = existingById ?? (emailFromSession
    ? await prisma.user.upsert({
        where: { email: emailFromSession },
        update: {},
        create: { email: emailFromSession, name: session.user.name ?? null },
        select: { id: true, email: true, name: true, stripeCustomerId: true, planType: true, credits: true },
      })
    : null);
  if (!dbUser) return NextResponse.json(errorEnvelope("BAD_REQUEST", "User email required"), { status: 400 });

  // Business rules: prevent duplicate/invalid purchases
  const planRequested = body.plan; // "Basic" | "Pro"
  const currentPlan = dbUser.planType ?? "FREE";
  const currentCredits = dbUser.credits ?? 0;

  // Disallow buying Basic again if already BASIC
  if (currentPlan === "BASIC" && planRequested === "Basic") {
    return NextResponse.json(errorEnvelope("ALREADY_BASIC", "You are already on Basic plan"), { status: 400 });
  }
  // Disallow downgrades from PRO to Basic
  if (currentPlan === "PRO" && planRequested === "Basic") {
    return NextResponse.json(errorEnvelope("DOWNGRADE_NOT_ALLOWED", "You cannot downgrade from Pro to Basic"), { status: 400 });
  }
  // If already PRO, only allow renewal when credits are exhausted
  if (currentPlan === "PRO" && planRequested === "Pro" && currentCredits > 0) {
    return NextResponse.json(errorEnvelope("PRO_ACTIVE", "You still have Pro credits available"), { status: 400 });
  }

  let customerId = dbUser.stripeCustomerId ?? null;
  if (customerId) {
    try {
      const c = await stripe.customers.retrieve(customerId);
      // @ts-ignore: deleted flag may exist
      if ((c as any).deleted) customerId = null;
    } catch {
      customerId = null;
    }
  }
  if (!customerId) {
    const created = await stripe.customers.create({
      email: dbUser.email ?? undefined,
      name: dbUser.name ?? undefined,
      metadata: { userId: dbUser.id },
    });
    customerId = created.id;
    await prisma.user.update({ where: { id: dbUser.id }, data: { stripeCustomerId: customerId } });
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
      userId: dbUser.id,
    },
  });

  // Store session ID in user record for webhook lookup
  await prisma.user.update({
    where: { id: dbUser.id },
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
    userId: dbUser.id,
    plan: body.plan,
    amount: body.amount,
    credits: body.credits,
    sessionId: sessionCheckout.id,
    customerId,
    timestamp: new Date().toISOString(),
  });

  return NextResponse.json({ sessionUrl: sessionCheckout.url });
}


