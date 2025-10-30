"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useBillingStore } from "@/lib/state/billing";
import { toast } from "sonner";
import { Loader2, ExternalLink } from "lucide-react";

export default function BillingActions() {
  const [loading, setLoading] = useState<"portal" | null>(null);
  const planType = useBillingStore((s) => s.planType);
  const credits = useBillingStore((s) => s.credits);

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
      <Button size="sm" variant="ghost" onClick={openPortal} disabled={loading !== null} aria-busy={loading === "portal"}>
        {loading === "portal" ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Opening…
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <ExternalLink className="h-4 w-4" />
            Manage Billing
          </span>
        )}
      </Button>
    </div>
  );
}


