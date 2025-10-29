import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { errorEnvelope } from "@/lib/errors";
import { getStripe } from "@/lib/billing/stripe";
import { isBillingEnabled } from "@/lib/billing/env";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.id) return NextResponse.json(errorEnvelope("UNAUTHORIZED", "Auth required"), { status: 401 });
  if (!isBillingEnabled()) return NextResponse.json(errorEnvelope("DISABLED", "Billing not configured"), { status: 400 });

  const stripe = getStripe();
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { stripeCustomerId: true } });
  if (!user?.stripeCustomerId) return NextResponse.json(errorEnvelope("NO_CUSTOMER", "No Stripe customer"), { status: 400 });

  const portal = await stripe.billingPortal.sessions.create({ customer: user.stripeCustomerId });
  return NextResponse.json({ url: portal.url });
}


