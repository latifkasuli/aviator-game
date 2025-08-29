-- CreateEnum
CREATE TYPE "public"."QuestType" AS ENUM ('DAILY_LOGIN', 'PLACE_BETS', 'SUCCESSFUL_REFERRAL', 'LUCKY_STREAK', 'HIGH_ROLLER', 'EARLY_BIRD', 'NIGHT_OWL', 'RISK_TAKER');

-- CreateEnum
CREATE TYPE "public"."QuestStatus" AS ENUM ('AVAILABLE', 'IN_PROGRESS', 'COMPLETED', 'CLAIMED', 'EXPIRED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."TransactionType" ADD VALUE 'QUEST_REWARD';
ALTER TYPE "public"."TransactionType" ADD VALUE 'REFERRAL_BONUS';

-- CreateTable
CREATE TABLE "public"."quests" (
    "id" TEXT NOT NULL,
    "type" "public"."QuestType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT,
    "rewardPoints" INTEGER NOT NULL,
    "targetValue" INTEGER NOT NULL,
    "resetPeriod" TEXT NOT NULL DEFAULT 'daily',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_quests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "status" "public"."QuestStatus" NOT NULL DEFAULT 'AVAILABLE',
    "currentValue" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "resetDate" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_quests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."quest_completions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questType" "public"."QuestType" NOT NULL,
    "rewardPoints" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "quest_completions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quests_type_key" ON "public"."quests"("type");

-- CreateIndex
CREATE INDEX "user_quests_userId_status_idx" ON "public"."user_quests"("userId", "status");

-- CreateIndex
CREATE INDEX "user_quests_resetDate_idx" ON "public"."user_quests"("resetDate");

-- CreateIndex
CREATE UNIQUE INDEX "user_quests_userId_questId_resetDate_key" ON "public"."user_quests"("userId", "questId", "resetDate");

-- CreateIndex
CREATE INDEX "quest_completions_userId_idx" ON "public"."quest_completions"("userId");

-- CreateIndex
CREATE INDEX "quest_completions_questType_idx" ON "public"."quest_completions"("questType");

-- CreateIndex
CREATE INDEX "quest_completions_completedAt_idx" ON "public"."quest_completions"("completedAt");

-- AddForeignKey
ALTER TABLE "public"."user_quests" ADD CONSTRAINT "user_quests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_quests" ADD CONSTRAINT "user_quests_questId_fkey" FOREIGN KEY ("questId") REFERENCES "public"."quests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quest_completions" ADD CONSTRAINT "quest_completions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
