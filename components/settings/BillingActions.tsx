"use client";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useBillingStore } from "@/lib/state/billing";
import { toast } from "sonner";
import { Loader2, ExternalLink } from "lucide-react";

export default function BillingActions() {
  const [loading, setLoading] = useState<"portal" | "cancel" | "downgrade" | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [reason, setReason] = useState("");
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const planType = useBillingStore((s) => s.planType);
  const credits = useBillingStore((s) => s.credits);
  const refreshBilling = useBillingStore((s) => s.refresh);
  const downgradeScheduled = useBillingStore((s) => s.downgradeScheduled);

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

  // Cancel handler
  async function cancelSubscription() {
    setLoading("cancel");
    try {
      const res = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        toast.error(e?.message ?? "Failed to cancel subscription.");
        setLoading(null);
        return;
      }
      toast.success("Subscription cancelled. All credits have been removed and your plan was downgraded to Free.");
      setShowModal(false);
      setReason("");
      window.location.reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to cancel subscription.");
    } finally {
      setLoading(null);
    }
  }

  async function scheduleDowngrade() {
    setLoading("downgrade");
    try {
      const res = await fetch("/api/billing/downgrade-schedule", { method: "POST" });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        toast.error(e?.message ?? "Failed to schedule downgrade.");
        setLoading(null);
        return;
      }
      toast.success("Downgrade scheduled", {
        description: "Your Pro plan will switch to Basic at the next renewal. You will keep remaining credits until then.",
        duration: 5000,
      });
      await refreshBilling();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to schedule downgrade.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <>
      {/* Modal: Cancel Subscription */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-xl p-6 w-full max-w-md border shadow-xl relative">
            <button className="absolute right-4 top-3 text-2xl text-gray-400 hover:text-gray-600" onClick={() => setShowModal(false)}>&times;</button>
            <h3 className="text-lg font-bold mb-2 text-red-700">Cancel Subscription?</h3>
            <p className="mb-2 text-sm text-red-600">Cancelling will IMMEDIATELY forfeit all your remaining paid credits and downgrade you to the Free plan. This action is irreversible.</p>
            <label className="mt-4 block text-xs text-zinc-600 font-semibold">Please tell us why you’re cancelling<span className="text-red-500">*</span></label>
            <textarea
              className="w-full mt-1 p-2 border border-zinc-300 rounded min-h-[50px] text-sm focus:ring-2 focus:border-[hsl(var(--primary))]"
              value={reason}
              ref={reasonRef}
              rows={3}
              placeholder="I no longer need parsing, I'm switching tools, I had problems..."
              onChange={e => setReason(e.target.value)}
              disabled={loading === "cancel"}
              required
            />
            <div className="mt-4 flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowModal(false)} disabled={loading === "cancel"}>Keep Subscription</Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                className="inline-flex gap-2"
                disabled={loading === "cancel" || reason.trim().length < 4}
                aria-busy={loading === "cancel"}
                onClick={cancelSubscription}
              >
                {loading === "cancel" ? (<><Loader2 className="h-4 w-4 animate-spin" /> Canceling…</>) : "Cancel Now"}
              </Button>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {planType === "PRO" && (
          <button
            className="disabled:opacity-60 disabled:pointer-events-none inline-flex px-3 py-1 cursor-pointer text-sm font-medium rounded-md items-center gap-2 bg-orange-500 text-white hover:bg-orange-600 rounded-md focus:ring-orange-600"
            disabled={downgradeScheduled || loading === "portal" || loading === "cancel" || loading === "downgrade"}
            onClick={scheduleDowngrade}
          >
            {downgradeScheduled ? "Downgrade scheduled" : (loading === "downgrade" ? (<span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Scheduling…</span>) : "Schedule downgrade to Basic")}
          </button>
        )}
        {downgradeScheduled && planType === "PRO" && (
          <p className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-md px-3 py-2">
            Your Pro plan will switch to Basic at the next renewal. You’ll keep any remaining credits until the switch.
          </p>
        )}
        {planType !== "FREE" && (
          <Button
            type="button"
            size="sm"
            variant="danger"
            disabled={loading === "portal" || loading === "cancel"}
            onClick={() => setShowModal(true)}
          >
            Cancel Subscription
          </Button>
        )}
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
    </>
  );
}


