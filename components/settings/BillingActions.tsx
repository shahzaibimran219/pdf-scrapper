"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useBillingStore } from "@/lib/state/billing";
import { toast } from "sonner";

export default function BillingActions() {
  const [loading, setLoading] = useState<"basic" | "pro" | "portal" | null>(null);
  const planType = useBillingStore((s) => s.planType);
  const credits = useBillingStore((s) => s.credits);

  async function startCheckout(plan: "Basic" | "Pro") {
    try {
      setLoading(plan === "Basic" ? "basic" : "pro");
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ 
          plan,
          amount: plan === "Basic" ? 1000 : 2000, // $10 or $20 in cents
          credits: plan === "Basic" ? 10000 : 20000
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.message ?? "Checkout failed");
      }
      const data = await res.json();
      window.location.href = data.sessionUrl;
    } catch (e: any) {
      toast.error(e?.message ?? "Checkout failed");
    } finally {
      setLoading(null);
    }
  }

  async function openPortal() {
    try {
      setLoading("portal");
      const res = await fetch("/api/billing/portal", { method: "POST" });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        if (e?.code === "PORTAL_NOT_CONFIGURED") {
          toast.error("Customer portal not configured. Please configure it in your Stripe dashboard first.", {
            duration: 8000,
            action: {
              label: "Configure Portal",
              onClick: () => window.open("https://dashboard.stripe.com/test/settings/billing/portal", "_blank")
            }
          });
        } else {
          throw new Error(e?.message ?? "Portal failed");
        }
        return;
      }
      const data = await res.json();
      window.location.href = data.url;
    } catch (e: any) {
      toast.error(e?.message ?? "Portal failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="secondary"
        onClick={() => startCheckout("Basic")}
        disabled={loading !== null || planType !== "FREE"}
        title={planType !== "FREE" ? "Already subscribed or on Pro" : undefined}
      >
        {loading === "basic" ? "Starting…" : "Subscribe Basic"}
      </Button>
      <Button
        size="sm"
        onClick={() => startCheckout("Pro")}
        disabled={
          loading !== null ||
          (planType === "PRO" && credits > 0)
        }
        title={planType === "PRO" && credits > 0 ? "You still have Pro credits" : undefined}
      >
        {loading === "pro" ? "Starting…" : "Upgrade to Pro"}
      </Button>
      <Button size="sm" variant="ghost" onClick={openPortal} disabled={loading !== null}>
        {loading === "portal" ? "Opening…" : "Manage Billing"}
      </Button>
    </div>
  );
}


