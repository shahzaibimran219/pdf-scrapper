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

  try {
    const portal = await stripe.billingPortal.sessions.create({ 
      customer: user.stripeCustomerId,
      return_url: `${process.env.NEXTAUTH_URL}/dashboard/settings`,
    });
    return NextResponse.json({ url: portal.url });
  } catch (error: any) {
    console.error("[BILLING PORTAL] Error:", error.message);
    
    // If portal is not configured, provide helpful error
    if (error.code === 'resource_missing' || error.message.includes('configuration')) {
      return NextResponse.json(errorEnvelope(
        "PORTAL_NOT_CONFIGURED", 
        "Customer portal not configured. Please configure it in your Stripe dashboard first."
      ), { status: 400 });
    }
    
    return NextResponse.json(errorEnvelope("PORTAL_ERROR", "Portal creation failed"), { status: 500 });
  }
}


