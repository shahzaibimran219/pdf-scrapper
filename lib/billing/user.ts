import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type UserBillingSummary = {
  planType: "FREE" | "BASIC" | "PRO";
  credits: number;
  isLowCredits: boolean; // credits < 100
  needsRenewal: boolean; // credits < 100 and plan !== FREE and subscription expired
  needsUpgrade: boolean; // credits < 100 but subscription still active (ask to upgrade plan)
  downgradeScheduled?: boolean;
  subscriptionEndDate?: Date | null;
};

export async function getCurrentUserBilling(): Promise<UserBillingSummary | null> {
  const session = await getServerSession();
  if (!session?.user) return null;

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { id: session.user.id ?? "" },
        session.user.email ? { email: session.user.email } : { id: "__none__" },
      ],
    },
    select: { planType: true, credits: true, metadata: true, subscriptionEndDate: true },
  });

  if (!user) return { planType: "FREE", credits: 0, isLowCredits: true, needsRenewal: false, needsUpgrade: false };

  const isLowCredits = (user.credits ?? 0) < 100;
  const now = new Date();
  const subscriptionActive = user.subscriptionEndDate ? new Date(user.subscriptionEndDate) > now : false;
  
  // needsRenewal: credits low AND subscription expired/ending
  const needsRenewal = isLowCredits && user.planType !== "FREE" && !subscriptionActive;
  // needsUpgrade: credits low BUT subscription still active (ask to upgrade to Pro for more credits)
  const needsUpgrade = isLowCredits && user.planType !== "FREE" && subscriptionActive && user.planType !== "PRO";
  
  const meta = (user.metadata as any) || {};
  const downgradeScheduled = !!meta.downgradeScheduled;
  return { 
    planType: user.planType as any, 
    credits: user.credits ?? 0, 
    isLowCredits, 
    needsRenewal, 
    needsUpgrade,
    downgradeScheduled,
    subscriptionEndDate: user.subscriptionEndDate ?? null,
  };
}


