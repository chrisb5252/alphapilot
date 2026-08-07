CREATE TYPE "PaperXPSourceType" AS ENUM ('PORTFOLIO_CREATED', 'TRADE_RECORDED', 'CHALLENGE_COMPLETED', 'ACHIEVEMENT_UNLOCKED', 'STREAK_MILESTONE', 'PORTFOLIO_REVIEW');
CREATE TYPE "PaperChallengeCadence" AS ENUM ('DAILY', 'WEEKLY');
CREATE TYPE "PaperChallengeStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "PaperChallengeParticipationStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'EXPIRED');

CREATE TABLE "PaperGameProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "totalXP" INTEGER NOT NULL DEFAULT 0,
  "currentLevel" INTEGER NOT NULL DEFAULT 1,
  "currentStreak" INTEGER NOT NULL DEFAULT 0,
  "longestStreak" INTEGER NOT NULL DEFAULT 0,
  "totalChallengesCompleted" INTEGER NOT NULL DEFAULT 0,
  "totalAchievementsUnlocked" INTEGER NOT NULL DEFAULT 0,
  "currentAlphaScore" DECIMAL(8,4),
  "highestAlphaScore" DECIMAL(8,4),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaperGameProfile_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PaperXPEvent" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "sourceType" "PaperXPSourceType" NOT NULL, "sourceId" TEXT NOT NULL, "xpAmount" INTEGER NOT NULL, "reason" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaperXPEvent_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PaperAchievement" (
  "id" TEXT NOT NULL, "key" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT NOT NULL, "category" TEXT NOT NULL, "xpReward" INTEGER NOT NULL, "criteriaKey" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaperAchievement_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PaperUserAchievement" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "achievementId" TEXT NOT NULL, "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "progress" INTEGER NOT NULL DEFAULT 100,
  CONSTRAINT "PaperUserAchievement_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PaperChallenge" (
  "id" TEXT NOT NULL, "key" TEXT NOT NULL, "cadence" "PaperChallengeCadence" NOT NULL, "title" TEXT NOT NULL, "description" TEXT NOT NULL, "criteriaKey" TEXT NOT NULL, "xpReward" INTEGER NOT NULL, "startsAt" TIMESTAMP(3) NOT NULL, "endsAt" TIMESTAMP(3) NOT NULL, "status" "PaperChallengeStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaperChallenge_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PaperChallengeParticipation" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "challengeId" TEXT NOT NULL, "status" "PaperChallengeParticipationStatus" NOT NULL DEFAULT 'IN_PROGRESS', "progress" INTEGER NOT NULL DEFAULT 0, "completedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaperChallengeParticipation_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PaperUserStreak" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "lastQualifyingDate" TIMESTAMP(3), "currentStreak" INTEGER NOT NULL DEFAULT 0, "longestStreak" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaperUserStreak_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PaperAlphaScoreSnapshot" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "paperPortfolioId" TEXT NOT NULL, "totalScore" DECIMAL(8,4) NOT NULL, "performanceScore" DECIMAL(8,4) NOT NULL, "drawdownScore" DECIMAL(8,4) NOT NULL, "diversificationScore" DECIMAL(8,4) NOT NULL, "consistencyScore" DECIMAL(8,4) NOT NULL, "challengeScore" DECIMAL(8,4) NOT NULL, "policyVersion" TEXT NOT NULL, "dataCoverage" DECIMAL(5,4) NOT NULL, "assumptions" JSONB, "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaperAlphaScoreSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaperGameProfile_userId_key" ON "PaperGameProfile"("userId");
CREATE UNIQUE INDEX "PaperXPEvent_userId_sourceType_sourceId_key" ON "PaperXPEvent"("userId", "sourceType", "sourceId");
CREATE INDEX "PaperXPEvent_userId_createdAt_idx" ON "PaperXPEvent"("userId", "createdAt");
CREATE UNIQUE INDEX "PaperAchievement_key_key" ON "PaperAchievement"("key");
CREATE UNIQUE INDEX "PaperUserAchievement_userId_achievementId_key" ON "PaperUserAchievement"("userId", "achievementId");
CREATE INDEX "PaperUserAchievement_userId_earnedAt_idx" ON "PaperUserAchievement"("userId", "earnedAt");
CREATE UNIQUE INDEX "PaperChallenge_key_startsAt_key" ON "PaperChallenge"("key", "startsAt");
CREATE INDEX "PaperChallenge_status_startsAt_endsAt_idx" ON "PaperChallenge"("status", "startsAt", "endsAt");
CREATE UNIQUE INDEX "PaperChallengeParticipation_userId_challengeId_key" ON "PaperChallengeParticipation"("userId", "challengeId");
CREATE INDEX "PaperChallengeParticipation_userId_status_updatedAt_idx" ON "PaperChallengeParticipation"("userId", "status", "updatedAt");
CREATE INDEX "PaperChallengeParticipation_challengeId_status_idx" ON "PaperChallengeParticipation"("challengeId", "status");
CREATE UNIQUE INDEX "PaperUserStreak_userId_key" ON "PaperUserStreak"("userId");
CREATE UNIQUE INDEX "PaperAlphaScoreSnapshot_paperPortfolioId_policyVersion_timestamp_key" ON "PaperAlphaScoreSnapshot"("paperPortfolioId", "policyVersion", "timestamp");
CREATE INDEX "PaperAlphaScoreSnapshot_userId_timestamp_idx" ON "PaperAlphaScoreSnapshot"("userId", "timestamp");
CREATE INDEX "PaperAlphaScoreSnapshot_paperPortfolioId_timestamp_idx" ON "PaperAlphaScoreSnapshot"("paperPortfolioId", "timestamp");

ALTER TABLE "PaperGameProfile" ADD CONSTRAINT "PaperGameProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaperXPEvent" ADD CONSTRAINT "PaperXPEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaperUserAchievement" ADD CONSTRAINT "PaperUserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaperUserAchievement" ADD CONSTRAINT "PaperUserAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "PaperAchievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaperChallengeParticipation" ADD CONSTRAINT "PaperChallengeParticipation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaperChallengeParticipation" ADD CONSTRAINT "PaperChallengeParticipation_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "PaperChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaperUserStreak" ADD CONSTRAINT "PaperUserStreak_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaperAlphaScoreSnapshot" ADD CONSTRAINT "PaperAlphaScoreSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaperAlphaScoreSnapshot" ADD CONSTRAINT "PaperAlphaScoreSnapshot_paperPortfolioId_fkey" FOREIGN KEY ("paperPortfolioId") REFERENCES "PaperPortfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
