"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function PaymentStatusBanner() {
   const searchParams = useSearchParams();
  const session_id = searchParams.get("session_id");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "fail">(session_id ? "loading" : "idle");
  const [showBadge, setShowBadge] = useState(false);

  useEffect(() => {
    if (session_id) {
      fetch(`/api/billing/verify-session?session_id=${session_id}`)
        .then(res => res.json())
        .then((data: { success?: boolean }) => {
          setStatus(data.success ? "success" : "fail");
          setShowBadge(true);
          setTimeout(() => {
            setShowBadge(false);
            // Remove session_id from URL
            const url = new URL(window.location.href);
            url.searchParams.delete("session_id");
            window.history.replaceState({}, document.title, url.toString());
          }, 5000);
        }).catch(() => {
          setStatus("fail");
          setShowBadge(true);
          setTimeout(() => setShowBadge(false), 5000);
        });
    }
  }, [session_id]);

  if (status === "loading") {
    return <div className="flex justify-center items-center h-16"><span className="animate-spin h-5 w-5 rounded-full border-2 border-zinc-300 border-t-[hsl(var(--primary))]"></span> <span className="ml-2 text-sm">Verifying payment…</span></div>;
  }
  if (!showBadge) return null;
  return status === "success" ? (
    <div className="rounded-xl border border-green-200 bg-green-50 p-4">
      <h2 className="text-lg font-medium text-green-800">Payment Successful!</h2>
      <h5 className="text-md text-green-700">Your subscription has been activated.</h5>
    </div>
  ) : status === "fail" ? (
    <div className="rounded-xl border border-red-300 bg-red-50 p-4">
      <h2 className="text-lg font-medium text-red-700">Payment Failed</h2>
      <h5 className="text-md text-red-600">
        We could not verify your payment. No changes were made to your plan. If you feel this is in error, contact support.
      </h5>
    </div>
  ) : null;
}
