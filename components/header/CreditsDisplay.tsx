"use client";
import { Coins } from "lucide-react";
import { useBillingStore } from "@/lib/state/billing";

export default function CreditsDisplay() {
  const credits = useBillingStore((s) => s.credits);
  const planType = useBillingStore((s) => s.planType);

  // Calculate total credits based on plan
  const totalCredits = planType === "PRO" ? 20000 : planType === "BASIC" ? 10000 : 0;

  return (
    <div className="flex items-center gap-2 text-sm">
      <Coins className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
      <span className="text-[hsl(var(--foreground))]">
        <span className="font-medium">{credits.toLocaleString()}</span>
        {totalCredits > 0 && (
          <span className="text-[hsl(var(--muted-foreground))]">/{totalCredits.toLocaleString()}</span>
        )}
      </span>
    </div>
  );
}

