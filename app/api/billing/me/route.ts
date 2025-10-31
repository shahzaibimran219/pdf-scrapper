import { NextResponse } from "next/server";
import { getCurrentUserBilling } from "@/lib/billing/user";

export const runtime = "nodejs";

export async function GET() {
  const billing = await getCurrentUserBilling();
  return NextResponse.json(billing ?? { planType: "FREE", credits: 0, isLowCredits: true, needsRenewal: false, needsUpgrade: false });
}


