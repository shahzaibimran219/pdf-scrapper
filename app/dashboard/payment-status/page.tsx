"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";

export default function PaymentStatusPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session_id = searchParams.get("session_id");
  const [status, setStatus] = useState<"loading" | "success" | "fail">("loading");
  const [countdown, setCountdown] = useState(4);

  useEffect(() => {
    if (!session_id) {
      setStatus("fail");
      return;
    }
    fetch(`/api/billing/verify-session?session_id=${session_id}`)
      .then(res => res.json())
      .then(data => {
        const ok = !!data.success;
        setStatus(ok ? "success" : "fail");
        if (ok) {
          // Start countdown and redirect at 0
          setCountdown(4);
          const iv = window.setInterval(() => {
            setCountdown((c) => {
              if (c <= 1) {
                window.clearInterval(iv);
                router.push("/dashboard/settings");
                return 0;
              }
              return c - 1;
            });
          }, 1000);
        }
      })
      .catch(() => setStatus("fail"));
  }, [session_id, router]);

  return (
    <main className="flex min-h-[40vh] items-center justify-center bg-gradient-to-b from-white to-zinc-50 px-2">
      <div className="bg-white lg:min-w-[340px] max-w-md w-full rounded-2xl shadow-xl py-6 px-5 flex flex-col items-center border relative">
        {status === "loading" && (
          <>
            <div className="h-16 w-16 rounded-full border-4 border-zinc-100 border-t-[hsl(var(--primary))] animate-spin mb-4" />
            <h2 className="text-lg font-semibold mb-1 text-zinc-800">Verifying your payment…</h2>
            <p className="text-sm text-zinc-500 text-center">Please wait while we confirm your payment with Stripe. You will be redirected to your dashboard shortly.</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 className="h-16 w-16 text-green-500 mb-1" />
            <h2 className="text-xl font-bold text-green-700 mb-0.5">Payment Successful!</h2>
            <p className="text-center text-zinc-700 mb-1">Your subscription has been activated.</p>
            <p className="text-center text-zinc-500 text-sm">Redirecting to your dashboard in {countdown}s…</p>
          </>
        )}
        {status === "fail" && (
          <>
            <XCircle className="h-16 w-16 text-red-500 mb-1" />
            <h2 className="text-xl font-bold text-red-700 mb-0.5">Payment Failed</h2>
            <p className="text-center text-zinc-700 mb-4">We could not verify your payment. Your subscription was not changed. If this was an error, please try again or contact support.</p>
            <button
              className="rounded bg-zinc-200 text-zinc-800 px-6 py-2 font-semibold text-sm mt-2 shadow hover:bg-zinc-300"
              onClick={() => router.push("/dashboard/settings")}
            >
              Back to Dashboard
            </button>
          </>
        )}
      </div>
    </main>
  );
}
