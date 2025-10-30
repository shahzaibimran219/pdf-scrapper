import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/billing/stripe";
import { errorEnvelope } from "@/lib/errors";

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.id) return NextResponse.json(errorEnvelope("UNAUTHORIZED", "Auth required"), { status: 401 });

  let body: { reason: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(errorEnvelope("BAD_REQUEST", "Invalid JSON"), { status: 400 });
  }
  if (!body.reason || typeof body.reason !== "string" || body.reason.trim().length < 4) {
    return NextResponse.json(errorEnvelope("MISSING_REASON", "Cancellation reason required."), { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json(errorEnvelope("NO_USER", "User not found"), { status: 404 });
  const planType = user.planType;
  if (planType === "FREE" || !user.stripeSubscriptionId) {
    return NextResponse.json(errorEnvelope("ALREADY_FREE", "No active subscription to cancel."), { status: 400 });
  }

  // Store cancellation reason
  await prisma.subscriptionCancellation.create({
    data: {
      userId: user.id,
      planType,
      reason: body.reason.trim(),
    },
  });

  // Cancel Stripe subscription
  try {
    const stripe = getStripe();
    await stripe.subscriptions.cancel(user.stripeSubscriptionId);
  } catch (err: any) {
    return NextResponse.json(errorEnvelope("STRIPE_ERROR", "Failed to cancel Stripe subscription."), { status: 500 });
  }

  // Remove DB subscription, zero credits, freeze scraping, set free plan
  await prisma.user.update({
    where: { id: user.id },
    data: {
      planType: "FREE",
      credits: 0,
      scrapingFrozen: true,
      stripeSubscriptionId: null,
    },
  });

  return NextResponse.json({ ok: true });
}
