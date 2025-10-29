import { prisma } from "@/lib/prisma";

export async function grantCredits(userId: string, amount: number, meta?: unknown) {
  console.log(`[CREDITS] Granting ${amount} credits to user ${userId}`, { meta });
  
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { credits: true } });
    const oldCredits = user?.credits || 0;
    
    await tx.user.update({ where: { id: userId }, data: { credits: { increment: amount } } });
    await tx.creditLedger.create({
      data: { userId, delta: amount, reason: "SUBSCRIPTION_GRANT", meta: meta as any },
    });
    
    console.log(`[CREDITS] User ${userId} credits: ${oldCredits} → ${oldCredits + amount} (+${amount})`);
  });
}

export async function debitCreditsForResume(userId: string, resumeId: string, amount = 100) {
  console.log(`[CREDITS] Attempting to debit ${amount} credits from user ${userId} for resume ${resumeId}`);
  
  await prisma.$transaction(async (tx) => {
    const u = await tx.user.findUnique({ where: { id: userId }, select: { credits: true } });
    if (!u || u.credits < amount) {
      console.log(`[CREDITS] INSUFFICIENT_CREDITS: User ${userId} has ${u?.credits || 0} credits, needs ${amount}`);
      throw new Error("INSUFFICIENT_CREDITS");
    }
    
    const oldCredits = u.credits;
    await tx.user.update({ where: { id: userId }, data: { credits: { decrement: amount } } });
    await tx.creditLedger.create({
      data: { userId, delta: -amount, reason: "EXTRACTION_DEBIT", resumeId },
    });
    
    console.log(`[CREDITS] User ${userId} credits: ${oldCredits} → ${oldCredits - amount} (-${amount}) for resume ${resumeId}`);
  });
}


