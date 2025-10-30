"use client";
import { useBillingStore } from "@/lib/state/billing";
import { AlertCircle } from "lucide-react";

export default function BillingBanner() {
  // Read individual slices to avoid creating a new object each render
  const credits = useBillingStore((s) => s.credits);
  const isLowCredits = useBillingStore((s) => s.isLowCredits);
  const needsRenewal = useBillingStore((s) => s.needsRenewal);
  const planType = useBillingStore((s) => s.planType);
  const downgradeScheduled = useBillingStore((s) => s.downgradeScheduled);

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
  if (downgradeScheduled && planType === "PRO") {
    return (
      <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
        <h3 className="text-sm font-medium text-orange-800 flex items-center gap-2"> <AlertCircle className="h-4 w-4 text-orange-500" /> Downgrade Scheduled</h3>
        <p className="text-sm text-orange-700">Your plan is scheduled to change to Basic at the next renewal. You’ll keep your remaining credits until then.</p>
      </div>
    );
  }
  return null;
}


