"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowUp } from "lucide-react";
import { useBillingStore } from "@/lib/state/billing";

export default function UpgradeButton() {
  const credits = useBillingStore((s) => s.credits);
  const planType = useBillingStore((s) => s.planType);
  const isHydrated = useBillingStore((s) => s.isHydrated);

  // Don't show button until billing data is loaded (prevent flash)
  if (!isHydrated) {
    return null;
  }

  // Show upgrade button if credits < 200 and plan is BASIC or FREE
  if (credits >= 200 || (planType !== "BASIC" && planType !== "FREE")) {
    return null;
  }

  return (
    <Link href="/dashboard/settings" prefetch>
      <Button variant="primary" size="sm" className="gap-2">
        <ArrowUp className="h-4 w-4" />
        <span className="hidden sm:inline">Upgrade</span>
      </Button>
    </Link>
  );
}

