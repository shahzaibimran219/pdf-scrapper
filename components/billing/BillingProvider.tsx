"use client";
import { useEffect } from "react";
import { useBillingStore } from "@/lib/state/billing";

export default function BillingProvider({ children }: { children: React.ReactNode }) {
  const refresh = useBillingStore((s) => s.refresh);

  // Initial hydration
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Refresh when tab/window regains focus or becomes visible
  useEffect(() => {
    const onFocus = () => { void refresh(); };
    const onVisibility = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  return <>{children}</>;
}


