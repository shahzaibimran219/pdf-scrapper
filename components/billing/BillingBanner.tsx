"use client";
import { useBillingStore } from "@/lib/state/billing";
import { AlertCircle, ArrowUp } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function BillingBanner() {
  // Read individual slices to avoid creating a new object each render
  const credits = useBillingStore((s) => s.credits);
  const isLowCredits = useBillingStore((s) => s.isLowCredits);
  const needsRenewal = useBillingStore((s) => s.needsRenewal);
  const needsUpgrade = useBillingStore((s) => s.needsUpgrade);
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
  if (needsUpgrade) {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-sm font-medium text-blue-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-blue-500" /> Credits Running Low
            </h3>
            <p className="text-sm text-blue-700 mt-1">
              You have {credits} credits remaining, but your subscription is still active. Upgrade to Pro to get 20,000 credits per month.
            </p>
          </div>
          <Link href="/dashboard/settings" prefetch>
            <Button variant="primary" size="sm" className="gap-2 whitespace-nowrap">
              <ArrowUp className="h-4 w-4" />
              Upgrade
            </Button>
          </Link>
        </div>
      </div>
    );
  }
  if (isLowCredits && !needsRenewal && !needsUpgrade) {
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
        <p className="text-sm text-orange-700">Your plan is scheduled to change to Basic at the next renewal. You'll keep your remaining credits until then.</p>
      </div>
    );
  }
  return null;
}


