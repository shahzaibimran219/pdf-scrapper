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

  let event: any;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET ?? "");
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
  }

  // Idempotency: skip if we already processed
  const exists = await prisma.billingEventLog.findUnique({ where: { eventId: event.id } });
  if (exists) return NextResponse.json({ ok: true, idempotent: true });

  await prisma.billingEventLog.create({ data: { eventId: event.id, type: event.type, payloadMinimal: { id: event.id, type: event.type } as any } });

  try {
    if (event.type === "invoice.paid") {
      const invoice = event.data.object;
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
      const customerId = subscription.customer as string;
      const user = await prisma.user.findFirst({ where: { stripeCustomerId: customerId } });
      if (user) {
        const priceId = subscription.items.data[0]?.price?.id;
        const planType = priceId === process.env.STRIPE_PRICE_PRO ? "PRO" : "BASIC";
        const grant = planType === "PRO" ? 20000 : 10000;
        await prisma.user.update({ where: { id: user.id }, data: { planType, scrapingFrozen: false, stripePriceId: priceId ?? undefined, stripeSubscriptionId: subscription.id } });
        await grantCredits(user.id, grant, { eventId: event.id, priceId });
      }
    }

    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object;
      const customerId = sub.customer as string;
      const priceId = sub.items.data[0]?.price?.id;
      const user = await prisma.user.findFirst({ where: { stripeCustomerId: customerId } });
      if (user) {
        const planType = priceId === process.env.STRIPE_PRICE_PRO ? "PRO" : "BASIC";
        const prevPlan = user.stripePriceId === process.env.STRIPE_PRICE_PRO ? "PRO" : user.stripePriceId ? "BASIC" : "FREE";
        await prisma.user.update({ where: { id: user.id }, data: { planType, stripePriceId: priceId ?? undefined, stripeSubscriptionId: sub.id } });
        if (prevPlan !== "PRO" && planType === "PRO") {
          await grantCredits(user.id, 20000, { eventId: event.id, priceId });
        }
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      const customerId = sub.customer as string;
      const user = await prisma.user.findFirst({ where: { stripeCustomerId: customerId } });
      if (user) {
        await prisma.user.update({ where: { id: user.id }, data: { planType: "FREE", scrapingFrozen: true } });
      }
    }
  } catch (err: any) {
    console.error("[stripe webhook] handler error", err?.message);
  }

  return NextResponse.json({ ok: true });
}


