export function isBillingEnabled() {
  return !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_PUBLIC_KEY;
}

export function assertTestMode() {
  const sk = process.env.STRIPE_SECRET_KEY ?? "";
  if (!sk.startsWith("sk_test_")) {
    console.warn("[billing] STRIPE_SECRET_KEY is not a test key. Refusing to run billing in non-test mode.");
    throw new Error("Stripe billing requires test mode (sk_test_*) in this environment.");
  }
}

export function getSuccessUrl() {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return `${base}/dashboard/payment-status?session_id={CHECKOUT_SESSION_ID}`;
}

export function getCancelUrl() {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return `${base}/dashboard/settings?checkout=cancel`;
}

export function getPriceId(plan: "Basic" | "Pro") {
  const basic = process.env.STRIPE_PRICE_BASIC;
  const pro = process.env.STRIPE_PRICE_PRO;
  if (plan === "Basic" && basic) return basic;
  if (plan === "Pro" && pro) return pro;
  throw new Error("Unknown or missing STRIPE_PRICE_* for requested plan");
}


