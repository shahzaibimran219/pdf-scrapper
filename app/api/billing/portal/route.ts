import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { errorEnvelope } from "@/lib/errors";
import { getStripe } from "@/lib/billing/stripe";
import { isBillingEnabled } from "@/lib/billing/env";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.id) return NextResponse.json(errorEnvelope("UNAUTHORIZED", "Auth required"), { status: 401 });
  if (!isBillingEnabled()) return NextResponse.json(errorEnvelope("DISABLED", "Billing not configured"), { status: 400 });

  const stripe = getStripe();
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { stripeCustomerId: true } });
  if (!user?.stripeCustomerId) return NextResponse.json(errorEnvelope("NO_CUSTOMER", "No Stripe customer"), { status: 400 });

  try {
    const portal = await stripe.billingPortal.sessions.create({ 
      customer: user.stripeCustomerId,
      return_url: `${process.env.NEXTAUTH_URL}/dashboard/settings`,
    });
    return NextResponse.json({ url: portal.url });
  } catch (error: unknown) {
    const code = typeof error === 'object' && error && 'code' in error ? String((error as Record<string, unknown>).code) : undefined;
    const message = typeof error === 'object' && error && 'message' in error ? String((error as Record<string, unknown>).message) : '';
    console.error("[BILLING PORTAL] Error:", message);

    // If portal is not configured, provide helpful error
    if (code === 'resource_missing' || message.includes('configuration')) {
      return NextResponse.json(errorEnvelope(
        "PORTAL_NOT_CONFIGURED", 
        "Customer portal not configured. Please configure it in your Stripe dashboard first."
      ), { status: 400 });
    }

    return NextResponse.json(errorEnvelope("PORTAL_ERROR", "Portal creation failed"), { status: 500 });
  }
}


