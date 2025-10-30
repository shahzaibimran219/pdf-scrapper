-- CreateTable
CREATE TABLE "SubscriptionCancellation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planType" "PlanType" NOT NULL,
    "reason" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionCancellation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubscriptionCancellation_userId_cancelledAt_idx" ON "SubscriptionCancellation"("userId", "cancelledAt");

-- AddForeignKey
ALTER TABLE "SubscriptionCancellation" ADD CONSTRAINT "SubscriptionCancellation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
