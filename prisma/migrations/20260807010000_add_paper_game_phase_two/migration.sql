CREATE TYPE "PaperLeagueVisibility" AS ENUM ('PRIVATE');
CREATE TYPE "PaperSeasonStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "PaperCompetitionStatus" AS ENUM ('UPCOMING', 'OPEN', 'ACTIVE', 'CALCULATING', 'COMPLETED', 'CANCELLED');
CREATE TYPE "PaperCompetitionScoring" AS ENUM ('ALPHA_SCORE', 'SIMULATED_RETURN', 'CHALLENGE_POINTS');
CREATE TYPE "PaperCompetitionEntryStatus" AS ENUM ('ENTERED', 'WITHDRAWN', 'DISQUALIFIED', 'COMPLETED');

CREATE TABLE "PaperLeague" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, "ownerUserId" TEXT NOT NULL, "inviteCode" TEXT NOT NULL, "visibility" "PaperLeagueVisibility" NOT NULL DEFAULT 'PRIVATE', "maxMembers" INTEGER NOT NULL DEFAULT 20, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "PaperLeague_pkey" PRIMARY KEY ("id"));
CREATE TABLE "PaperLeagueMember" ("id" TEXT NOT NULL, "leagueId" TEXT NOT NULL, "userId" TEXT NOT NULL, "nickname" TEXT, "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PaperLeagueMember_pkey" PRIMARY KEY ("id"));
CREATE TABLE "PaperSeason" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT NOT NULL, "startsAt" TIMESTAMP(3) NOT NULL, "endsAt" TIMESTAMP(3) NOT NULL, "status" "PaperSeasonStatus" NOT NULL DEFAULT 'UPCOMING', "startingCashUSD" DECIMAL(24,10) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "PaperSeason_pkey" PRIMARY KEY ("id"));
CREATE TABLE "PaperCompetition" ("id" TEXT NOT NULL, "seasonId" TEXT, "key" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT NOT NULL, "startsAt" TIMESTAMP(3) NOT NULL, "endsAt" TIMESTAMP(3) NOT NULL, "startingCashUSD" DECIMAL(24,10) NOT NULL, "maxPositions" INTEGER, "scoringMethod" "PaperCompetitionScoring" NOT NULL DEFAULT 'ALPHA_SCORE', "status" "PaperCompetitionStatus" NOT NULL DEFAULT 'UPCOMING', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "PaperCompetition_pkey" PRIMARY KEY ("id"));
CREATE TABLE "PaperCompetitionEntry" ("id" TEXT NOT NULL, "competitionId" TEXT NOT NULL, "userId" TEXT NOT NULL, "paperPortfolioId" TEXT NOT NULL, "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "status" "PaperCompetitionEntryStatus" NOT NULL DEFAULT 'ENTERED', CONSTRAINT "PaperCompetitionEntry_pkey" PRIMARY KEY ("id"));
CREATE TABLE "PaperLeaderboardSnapshot" ("id" TEXT NOT NULL, "leaderboardKey" TEXT NOT NULL, "userId" TEXT NOT NULL, "rank" INTEGER NOT NULL, "nickname" TEXT NOT NULL, "alphaScore" DECIMAL(8,4), "simulatedReturn" DECIMAL(12,8), "challengePoints" INTEGER NOT NULL DEFAULT 0, "level" INTEGER NOT NULL, "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PaperLeaderboardSnapshot_pkey" PRIMARY KEY ("id"));

CREATE UNIQUE INDEX "PaperLeague_inviteCode_key" ON "PaperLeague"("inviteCode");
CREATE INDEX "PaperLeague_ownerUserId_createdAt_idx" ON "PaperLeague"("ownerUserId", "createdAt");
CREATE UNIQUE INDEX "PaperLeagueMember_leagueId_userId_key" ON "PaperLeagueMember"("leagueId", "userId");
CREATE INDEX "PaperLeagueMember_userId_joinedAt_idx" ON "PaperLeagueMember"("userId", "joinedAt");
CREATE INDEX "PaperSeason_status_startsAt_endsAt_idx" ON "PaperSeason"("status", "startsAt", "endsAt");
CREATE UNIQUE INDEX "PaperCompetition_key_key" ON "PaperCompetition"("key");
CREATE INDEX "PaperCompetition_status_startsAt_endsAt_idx" ON "PaperCompetition"("status", "startsAt", "endsAt");
CREATE INDEX "PaperCompetition_seasonId_idx" ON "PaperCompetition"("seasonId");
CREATE UNIQUE INDEX "PaperCompetitionEntry_competitionId_userId_key" ON "PaperCompetitionEntry"("competitionId", "userId");
CREATE INDEX "PaperCompetitionEntry_userId_enteredAt_idx" ON "PaperCompetitionEntry"("userId", "enteredAt");
CREATE INDEX "PaperCompetitionEntry_competitionId_status_idx" ON "PaperCompetitionEntry"("competitionId", "status");
CREATE UNIQUE INDEX "PaperLeaderboardSnapshot_leaderboardKey_userId_timestamp_key" ON "PaperLeaderboardSnapshot"("leaderboardKey", "userId", "timestamp");
CREATE INDEX "PaperLeaderboardSnapshot_leaderboardKey_rank_timestamp_idx" ON "PaperLeaderboardSnapshot"("leaderboardKey", "rank", "timestamp");
CREATE INDEX "PaperLeaderboardSnapshot_userId_timestamp_idx" ON "PaperLeaderboardSnapshot"("userId", "timestamp");

ALTER TABLE "PaperLeague" ADD CONSTRAINT "PaperLeague_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaperLeagueMember" ADD CONSTRAINT "PaperLeagueMember_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "PaperLeague"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaperLeagueMember" ADD CONSTRAINT "PaperLeagueMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaperCompetition" ADD CONSTRAINT "PaperCompetition_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "PaperSeason"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaperCompetitionEntry" ADD CONSTRAINT "PaperCompetitionEntry_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "PaperCompetition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaperCompetitionEntry" ADD CONSTRAINT "PaperCompetitionEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaperCompetitionEntry" ADD CONSTRAINT "PaperCompetitionEntry_paperPortfolioId_fkey" FOREIGN KEY ("paperPortfolioId") REFERENCES "PaperPortfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaperLeaderboardSnapshot" ADD CONSTRAINT "PaperLeaderboardSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
