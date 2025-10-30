import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type UserBillingSummary = {
  planType: "FREE" | "BASIC" | "PRO";
  credits: number;
  isLowCredits: boolean; // credits < 100
  needsRenewal: boolean; // credits < 100 and plan !== FREE
  downgradeScheduled?: boolean;
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
    select: { planType: true, credits: true, metadata: true },
  });

  if (!user) return { planType: "FREE", credits: 0, isLowCredits: true, needsRenewal: false };

  const isLowCredits = (user.credits ?? 0) < 100;
  const needsRenewal = isLowCredits && user.planType !== "FREE";
  const meta = (user.metadata as any) || {};
  const downgradeScheduled = !!meta.downgradeScheduled;
  return { planType: user.planType as any, credits: user.credits ?? 0, isLowCredits, needsRenewal, downgradeScheduled };
}


