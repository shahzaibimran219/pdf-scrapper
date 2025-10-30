"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";

function PaymentStatusInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session_id = searchParams.get("session_id");
  const [status, setStatus] = useState<"loading" | "success" | "fail">("loading");
  const [countdown, setCountdown] = useState(4);
  const ivRef = useRef<number | null>(null);

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
          setCountdown(4);
          if (ivRef.current) window.clearInterval(ivRef.current);
          ivRef.current = window.setInterval(() => setCountdown((c) => c - 1), 1000) as unknown as number;
        }
      })
      .catch(() => setStatus("fail"));
    return () => { if (ivRef.current) window.clearInterval(ivRef.current); };
  }, [session_id]);

  useEffect(() => {
    if (status === "success" && countdown <= 0) {
      if (ivRef.current) window.clearInterval(ivRef.current);
      router.push("/dashboard/settings");
    }
  }, [status, countdown, router]);

  return (
    <div className="bg-white max-w-md w-full rounded-2xl shadow-xl py-8 px-6 flex flex-col items-center border">
      {status === "loading" && (
        <>
          <div className="h-16 w-16 rounded-full border-4 border-zinc-100 border-t-[hsl(var(--primary))] animate-spin mb-4" />
          <h2 className="text-lg font-semibold mb-1 text-zinc-800">Verifying your payment…</h2>
          <p className="text-sm text-zinc-500 text-center">Please wait while we confirm your payment with Stripe.</p>
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
          <p className="text-center text-zinc-700 mb-4">We could not verify your payment. If this was an error, please try again or contact support.</p>
          <button
            className="rounded bg-zinc-200 text-zinc-800 px-6 py-2 font-semibold text-sm mt-2 shadow hover:bg-zinc-300"
            onClick={() => router.push("/dashboard/settings")}
          >
            Back to Dashboard
          </button>
        </>
      )}
    </div>
  );
}

export default function PaymentStatusStandalonePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-zinc-50 px-4">
      <Suspense fallback={
        <div className="bg-white max-w-md w-full rounded-2xl shadow-xl py-8 px-6 flex flex-col items-center border">
          <div className="h-16 w-16 rounded-full border-4 border-zinc-100 border-t-[hsl(var(--primary))] animate-spin mb-4" />
          <h2 className="text-lg font-semibold mb-1 text-zinc-800">Loading…</h2>
          <p className="text-sm text-zinc-500 text-center">Preparing payment status…</p>
        </div>
      }>
        <PaymentStatusInner />
      </Suspense>
    </main>
  );
}
