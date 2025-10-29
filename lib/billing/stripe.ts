import Stripe from "stripe";
import { assertTestMode } from "@/lib/billing/env";

let stripe: Stripe | null = null;

export function getStripe() {
  if (!stripe) {
    const sk = process.env.STRIPE_SECRET_KEY;
    if (!sk) throw new Error("Missing STRIPE_SECRET_KEY");
    assertTestMode();
    stripe = new Stripe(sk);
  }
  return stripe;
}


