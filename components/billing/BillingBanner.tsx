"use client";
import { useBillingStore } from "@/lib/state/billing";

export default function BillingBanner() {
  // Read individual slices to avoid creating a new object each render
  const credits = useBillingStore((s) => s.credits);
  const isLowCredits = useBillingStore((s) => s.isLowCredits);
  const needsRenewal = useBillingStore((s) => s.needsRenewal);
  const planType = useBillingStore((s) => s.planType);

  if (needsRenewal) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <h3 className="text-sm font-medium text-red-800">⚠️ Subscription Renewal Required</h3>
        <p className="text-sm text-red-700">You have {credits} credits remaining. You need at least 100 credits to scrape PDFs. Please renew your subscription.</p>
      </div>
    );
  }
  if (isLowCredits) {
    return (
      <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
        <h3 className="text-sm font-medium text-yellow-800">⚠️ Low Credits Warning</h3>
        <p className="text-sm text-yellow-700">You have {credits} credits remaining. Consider upgrading your plan.</p>
      </div>
    );
  }
  return null;
}


