import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/billing/stripe";

export async function GET(req: NextRequest) {
  const session_id = req.nextUrl.searchParams.get("session_id");
  if (!session_id) {
    return NextResponse.json({ success: false, error: "No session_id provided." });
  }
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (
      session.payment_status === "paid" ||
      session.status === "complete"
    ) {
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ success: false });
  } catch {
    return NextResponse.json({ success: false });
  }
}
