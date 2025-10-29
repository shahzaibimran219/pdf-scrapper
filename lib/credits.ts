import { prisma } from "@/lib/prisma";

export async function grantCredits(userId: string, amount: number, meta?: unknown) {
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { credits: { increment: amount } } });
    await tx.creditLedger.create({
      data: { userId, delta: amount, reason: "SUBSCRIPTION_GRANT", meta: meta as any },
    });
  });
}

export async function debitCreditsForResume(userId: string, resumeId: string, amount = 100) {
  await prisma.$transaction(async (tx) => {
    const u = await tx.user.findUnique({ where: { id: userId }, select: { credits: true } });
    if (!u || u.credits < amount) throw new Error("INSUFFICIENT_CREDITS");
    await tx.user.update({ where: { id: userId }, data: { credits: { decrement: amount } } });
    await tx.creditLedger.create({
      data: { userId, delta: -amount, reason: "EXTRACTION_DEBIT", resumeId },
    });
  });
}


