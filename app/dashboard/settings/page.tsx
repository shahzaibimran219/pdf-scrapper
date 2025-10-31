import { getCurrentUserBilling } from "@/lib/billing/user";
import BillingActions from "@/components/settings/BillingActions";
import PlanCardGrid from "@/components/settings/PlanCardGrid";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings - Dashboard | PDF Resume Scrapper",
  description: "Manage your subscription, billing, and account settings",
};

export default async function DashboardSettingsPage() {
  const billing = await getCurrentUserBilling();
 
  // Show renewal/upgrade warnings if credits are low
  const isLowCredits = billing?.isLowCredits ?? false;
  const needsRenewal = billing?.needsRenewal ?? false;
  const needsUpgrade = billing?.needsUpgrade ?? false;

  return (
    <div className="space-y-6">
      {needsRenewal && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <h3 className="text-sm font-medium text-red-800">⚠️ Subscription Renewal Required</h3>
          <p className="text-sm text-red-700">
            You have {billing?.credits ?? 0} credits remaining. You need at least 100 credits to scrape PDFs. 
            Please renew your subscription to continue using the service.
          </p>
        </div>
      )}

      {needsUpgrade && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="text-sm font-medium text-amber-800">⚠️ Credits Running Low</h3>
          <p className="text-sm text-amber-700">
            You have {billing?.credits ?? 0} credits remaining, but your subscription is still active. 
            Upgrade to Pro below to get 20,000 credits per month.
          </p>
        </div>
      )}

      {isLowCredits && !needsRenewal && !needsUpgrade && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
          <h3 className="text-sm font-medium text-yellow-800">⚠️ Low Credits Warning</h3>
          <p className="text-sm text-yellow-700">
            You have {billing?.credits ?? 0} credits remaining. Consider upgrading your plan for more credits.
          </p>
        </div>
      )}

      <PlanCardGrid billing={billing ?? {planType: "FREE", credits: 0}} />

      <div className="rounded-xl border bg-[hsl(var(--card))] p-5 shadow-sm">
        <h2 className="text-lg font-medium">Subscription</h2>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Manage your plan and credits. Test mode only.</p>
        <div className="mt-4 grid gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-[hsl(var(--muted-foreground))]">Current plan</span>
            <span className="font-medium">{billing?.planType ?? "FREE"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[hsl(var(--muted-foreground))]">Credits</span>
            <span className={`font-medium ${isLowCredits ? 'text-red-600' : ''}`}>
              {billing?.credits ?? 0}
            </span>
          </div>
          {billing?.planType !== "FREE" && (
            <div className="flex items-center justify-between">
              <span className="text-[hsl(var(--muted-foreground))]">Status</span>
              <span className={`font-medium ${needsRenewal ? 'text-red-600' : 'text-green-600'}`}>
                {needsRenewal ? 'Needs Renewal' : 'Active'}
              </span>
            </div>
          )}
        </div>
        <div className="mt-4">
          <BillingActions />
        </div>
      </div>
    </div>
  );
}


