"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function BillingActions() {
  const [loading, setLoading] = useState<"basic" | "pro" | "portal" | null>(null);

  async function startCheckout(plan: "BASIC" | "PRO") {
    try {
      setLoading(plan === "BASIC" ? "basic" : "pro");
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
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
        throw new Error(e?.message ?? "Portal failed");
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
      <Button size="sm" variant="secondary" onClick={() => startCheckout("BASIC")} disabled={loading !== null}>
        {loading === "basic" ? "Starting…" : "Subscribe Basic"}
      </Button>
      <Button size="sm" onClick={() => startCheckout("PRO")} disabled={loading !== null}>
        {loading === "pro" ? "Starting…" : "Upgrade to Pro"}
      </Button>
      <Button size="sm" variant="ghost" onClick={openPortal} disabled={loading !== null}>
        {loading === "portal" ? "Opening…" : "Manage Billing"}
      </Button>
    </div>
  );
}


