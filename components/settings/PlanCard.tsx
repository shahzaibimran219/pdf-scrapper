"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, ArrowUpRight } from "lucide-react";

type Plan = {
  name: string;
  price: number;
  credits: number;
  desc: string;
};
type Billing = {
  planType: string;
  credits: number;
};

export default function PlanCard({ plan, billing }: { plan: Plan; billing: Billing }) {
  const [loading, setLoading] = useState(false);
  const isCurrent = billing?.planType?.toUpperCase() === plan.name.toUpperCase();
  const isPro = billing?.planType?.toUpperCase() === "PRO";

  async function handleCheckout() {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ 
          plan: plan.name,
          amount: plan.price * 100,
          credits: plan.credits
        }),
      });
      if (!res.ok) {
        setLoading(false);
        alert("Checkout failed");
        return;
      }
      const data = await res.json();
      if (data?.sessionUrl) {
        window.location.href = data.sessionUrl;
      } else if (data?.upgraded) {
        // In-place upgrade: refresh to reflect webhook-updated billing
        window.location.reload();
      }
    } finally {
      setLoading(false);
    }
  }

  let buttonText = '';
  let buttonIcon = null;
  let disabled = false;
  if (isCurrent) {
    buttonText = "Current Plan";
    disabled = true;
  } else if (billing?.planType === "FREE") {
    buttonText = "Subscribe";
    buttonIcon = <CreditCard className="h-4 w-4" />;
    disabled = false || loading;
  } else if (plan.name === "Basic") {
    buttonText = "Subscribe";
    buttonIcon = <CreditCard className="h-4 w-4" />;
    disabled = billing?.planType !== "FREE" || loading;
  } else if (plan.name === "Pro") {
    buttonText = isPro ? "Current Plan" : "Upgrade to Pro";
    buttonIcon = isPro ? null : <ArrowUpRight className="h-4 w-4" />;
    disabled = isPro || loading || billing?.planType === "FREE";
  }
  return (
    <div
      className={`rounded-2xl border p-6 shadow-sm bg-white/90 relative transition-all ${isCurrent ?
        "border-[hsl(var(--primary))] ring-2 ring-gray-200" :
        "border-zinc-200"}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg font-semibold tracking-tight">{plan.name}</span>
        {isCurrent && (
          <span className="ml-2 px-2 py-0.5 rounded bg-green-500 text-xs font-medium text-white">Current</span>
        )}
      </div>
      <div className="text-2xl font-bold mb-1">${plan.price}<span className="text-base text-zinc-500">/month</span></div>
      <div className="mb-2 text-sm text-zinc-600">{plan.credits.toLocaleString()} credits</div>
      <div className="mb-3 text-[0.97rem] text-zinc-500">{plan.desc}</div>
      <ul className="pl-4 mb-2 text-xs list-disc text-zinc-400">
        <li>All features unlocked ‧ Fast processing</li>
        <li>{plan.credits.toLocaleString()} resume credits</li>
        <li>Private secure storage</li>
      </ul>
      <Button
        onClick={handleCheckout}
        variant="primary"
        size="sm"
        className={`mt-2 w-full ${isCurrent ? "bg-green-500" : ""}`}
        disabled={disabled}
        aria-busy={loading}
      >
        {loading ? (
          <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Processing…</span>
        ) : (
          <span className="inline-flex items-center gap-2">{buttonIcon}{buttonText}</span>
        )}
      </Button>
    </div>
  );
}
