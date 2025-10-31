import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { errorEnvelope } from "@/lib/errors";
import { getStripe } from "@/lib/billing/stripe";
import { Prisma } from "@prisma/client";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.id) return NextResponse.json(errorEnvelope("UNAUTHORIZED", "Auth required"), { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json(errorEnvelope("NO_USER", "User not found"), { status: 404 });
  if (user.planType !== "PRO") return NextResponse.json(errorEnvelope("NOT_PRO", "Only Pro subscriptions can be downgraded"), { status: 400 });
  if (!user.stripeSubscriptionId) return NextResponse.json(errorEnvelope("NO_SUB", "No active subscription to downgrade"), { status: 400 });

  const stripe = getStripe();

  // Set cancel_at_period_end on the current subscription and mark intent for downgrade
  try {
    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true,
      metadata: { downgrade_to: "Basic" },
      proration_behavior: "none",
    });
  } catch (e: unknown) {
    const message = typeof e === 'object' && e && 'message' in e ? String((e as Record<string, unknown>).message) : 'Failed to schedule downgrade';
    console.error("[downgrade-schedule] stripe update error", e);
    return NextResponse.json(errorEnvelope("STRIPE_SUB_UPDATE", message), { status: 500 });
  }

  // Persist a simple flag for UI and webhook follow-up
  const meta = ((user.metadata as Prisma.InputJsonValue) ?? {}) as Record<string, unknown>;
  meta.downgradeScheduled = true;
  meta.downgradeTarget = "BASIC";
  await prisma.user.update({ where: { id: user.id }, data: { metadata: meta as Prisma.InputJsonValue } });

  return NextResponse.json({ ok: true });
}
