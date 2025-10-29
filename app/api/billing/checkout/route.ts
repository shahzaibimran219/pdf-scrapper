import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { errorEnvelope } from "@/lib/errors";
import { getStripe } from "@/lib/billing/stripe";
import { getCancelUrl, getPriceId, getSuccessUrl, isBillingEnabled } from "@/lib/billing/env";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.id) return NextResponse.json(errorEnvelope("UNAUTHORIZED", "Auth required"), { status: 401 });
  if (!isBillingEnabled()) return NextResponse.json(errorEnvelope("DISABLED", "Billing not configured"), { status: 400 });

  let body: { plan: "BASIC" | "PRO" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(errorEnvelope("BAD_REQUEST", "Invalid JSON"), { status: 400 });
  }

  const stripe = getStripe();
  const priceId = getPriceId(body.plan);

  // Ensure stripe customer
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { stripeCustomerId: true, email: true } });
  let customerId = user?.stripeCustomerId ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user?.email ?? undefined });
    customerId = customer.id;
    await prisma.user.update({ where: { id: session.user.id }, data: { stripeCustomerId: customerId } });
  }

  const sessionCheckout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: getSuccessUrl(),
    cancel_url: getCancelUrl(),
    allow_promotion_codes: true,
  });

  return NextResponse.json({ sessionUrl: sessionCheckout.url });
}


