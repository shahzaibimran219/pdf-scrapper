"use client";
import { create } from "zustand";

type BillingState = {
  planType: "FREE" | "BASIC" | "PRO";
  credits: number;
  isLowCredits: boolean;
  needsRenewal: boolean;
  needsUpgrade: boolean;
  downgradeScheduled?: boolean;
  setBilling: (p: Partial<BillingState>) => void;
  refresh: () => Promise<void>;
};

export const useBillingStore = create<BillingState>((set) => ({
  planType: "FREE",
  credits: 0,
  isLowCredits: false,
  needsRenewal: false,
  needsUpgrade: false,
  downgradeScheduled: false,
  setBilling: (p) => set(p as any),
  refresh: async () => {
    try {
      const res = await fetch("/api/billing/me", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      set({
        planType: data.planType ?? "FREE",
        credits: data.credits ?? 0,
        isLowCredits: data.isLowCredits ?? false,
        needsRenewal: data.needsRenewal ?? false,
        needsUpgrade: data.needsUpgrade ?? false,
        downgradeScheduled: !!data.downgradeScheduled,
      });
    } catch {}
  },
}));


