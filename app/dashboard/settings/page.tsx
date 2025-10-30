import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentUserBilling } from "@/lib/billing/user";
import BillingActions from "@/components/settings/BillingActions";
import { redirect } from "next/navigation";
import PlanCardGrid from "@/components/settings/PlanCardGrid";
import { getStripe } from "@/lib/billing/stripe";
 
export default async function DashboardSettingsPage({ searchParams }: { searchParams: Promise<{ checkout?: string, session_id?: string }> }) {
  const billing = await getCurrentUserBilling();
  const params = await searchParams;

  // Show renewal warning if credits are low
  const isLowCredits = billing?.isLowCredits ?? false;
  const needsRenewal = billing?.needsRenewal ?? false;

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

      {isLowCredits && !needsRenewal && (
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


