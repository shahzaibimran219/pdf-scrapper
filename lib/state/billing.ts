"use client";
import { create } from "zustand";

type BillingState = {
  planType: "FREE" | "BASIC" | "PRO";
  credits: number;
  isLowCredits: boolean;
  needsRenewal: boolean;
  needsUpgrade: boolean;
  downgradeScheduled?: boolean;
  isHydrated: boolean;
  setBilling: (p: Partial<Omit<BillingState, "isHydrated" | "setBilling" | "refresh">>) => void;
  refresh: () => Promise<void>;
};

export const useBillingStore = create<BillingState>((set) => ({
  planType: "FREE",
  credits: 0,
  isLowCredits: false,
  needsRenewal: false,
  needsUpgrade: false,
  downgradeScheduled: false,
  isHydrated: false,
  setBilling: (p) => set({ ...p, isHydrated: true }),
  refresh: async () => {
    try {
      const res = await fetch("/api/billing/me", { cache: "no-store" });
      if (!res.ok) {
        set({ isHydrated: true });
        return;
      }
      const data = await res.json() as Partial<Pick<BillingState, "planType" | "credits" | "isLowCredits" | "needsRenewal" | "needsUpgrade" | "downgradeScheduled">>;
      set({
        planType: data.planType ?? "FREE",
        credits: data.credits ?? 0,
        isLowCredits: data.isLowCredits ?? false,
        needsRenewal: data.needsRenewal ?? false,
        needsUpgrade: data.needsUpgrade ?? false,
        downgradeScheduled: !!data.downgradeScheduled,
        isHydrated: true,
      });
    } catch {
      set({ isHydrated: true });
    }
  },
}));


