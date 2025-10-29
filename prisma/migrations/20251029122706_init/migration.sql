-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('FREE', 'BASIC', 'PRO');

-- CreateEnum
CREATE TYPE "CreditReason" AS ENUM ('SUBSCRIPTION_GRANT', 'EXTRACTION_DEBIT', 'PLAN_CHANGE', 'MANUAL_ADJUST', 'REFUND', 'CORRECTION');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "credits" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "planType" "PlanType" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "scrapingFrozen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripePriceId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT;

-- CreateTable
CREATE TABLE "CreditLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" "CreditReason" NOT NULL,
    "resumeId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingEventLog" (
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payloadMinimal" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingEventLog_pkey" PRIMARY KEY ("eventId")
);

-- CreateIndex
CREATE INDEX "CreditLedger_userId_createdAt_idx" ON "CreditLedger"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CreditLedger_userId_reason_resumeId_key" ON "CreditLedger"("userId", "reason", "resumeId");

-- AddForeignKey
ALTER TABLE "CreditLedger" ADD CONSTRAINT "CreditLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
