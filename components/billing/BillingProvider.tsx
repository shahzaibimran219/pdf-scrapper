"use client";
import { useEffect } from "react";
import { useBillingStore } from "@/lib/state/billing";

export default function BillingProvider({ children }: { children: React.ReactNode }) {
  const refresh = useBillingStore((s) => s.refresh);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return <>{children}</>;
}


