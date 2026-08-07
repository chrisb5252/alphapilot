import { randomBytes } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getEntitlementsForUser } from "@/lib/entitlements";

export class PaperGamePhaseTwoError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export type LeaderboardCandidate = {
  userId: string;
  alphaScore: Prisma.Decimal;
  challengePoints: number;
  level: number;
};

export function rankLeaderboardRows(
  rows: LeaderboardCandidate[],
  currentUserId: string,
) {
  const sorted = [...rows].sort(
    (a, b) =>
      b.alphaScore.cmp(a.alphaScore) || a.userId.localeCompare(b.userId),
  );
  const visible = sorted.slice(0, 50).map((row, index) => ({
    rank: index + 1,
    nickname:
      row.userId === currentUserId ? "You" : `Paper investor ${index + 1}`,
    alphaScore: row.alphaScore.toString(),
    challengePoints: row.challengePoints,
    level: row.level,
    isCurrentUser: row.userId === currentUserId,
  }));
  const ownIndex = sorted.findIndex((row) => row.userId === currentUserId);
  if (ownIndex >= 50) {
    const own = sorted[ownIndex];
    visible.push({
      rank: ownIndex + 1,
      nickname: "You",
      alphaScore: own.alphaScore.toString(),
      challengePoints: own.challengePoints,
      level: own.level,
      isCurrentUser: true,
    });
  }
  return visible;
}

function inviteCode() {
  return randomBytes(6).toString("base64url").toUpperCase();
}

async function ensurePublicCompetitionCatalog(now = new Date()) {
  const startsAt = new Date(now);
  startsAt.setUTCDate(startsAt.getUTCDate() + 2);
  startsAt.setUTCHours(0, 0, 0, 0);
  const endsAt = new Date(startsAt);
  endsAt.setUTCDate(endsAt.getUTCDate() + 7);
  await prisma.paperCompetition.upsert({
    where: { key: "WEEKLY_DIVERSIFICATION" },
    create: {
      key: "WEEKLY_DIVERSIFICATION",
      name: "Diversification Week",
      description:
        "Free simulated competition scored by AlphaScore. No money, wagers, or real orders.",
      startsAt,
      endsAt,
      startingCashUSD: "100000",
      maxPositions: 10,
      scoringMethod: "ALPHA_SCORE",
      status: "OPEN",
    },
    update: {},
  });
}

export async function createPaperLeague(
  userId: string,
  name: string,
  nickname?: string,
) {
  const trimmed = name.trim();
  if (trimmed.length < 3 || trimmed.length > 60)
    throw new PaperGamePhaseTwoError(
      "League names must be 3 to 60 characters.",
    );
  const entitlement = getEntitlementsForUser(userId);
  const owned = await prisma.paperLeague.count({
    where: { ownerUserId: userId },
  });
  if (owned >= entitlement.paperLeagueCreationLimit)
    throw new PaperGamePhaseTwoError(
      "Your current plan has reached its private-league creation limit.",
      403,
    );
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.paperLeague.create({
        data: {
          name: trimmed,
          ownerUserId: userId,
          inviteCode: inviteCode(),
          members: {
            create: { userId, nickname: nickname?.trim().slice(0, 30) || null },
          },
        },
        include: { members: true },
      });
    } catch (error) {
      if (!(
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ))
        throw error;
    }
  }
  throw new PaperGamePhaseTwoError(
    "Unable to create a secure invite code. Please try again.",
  );
}

export async function joinPaperLeague(
  userId: string,
  code: string,
  nickname?: string,
) {
  const league = await prisma.paperLeague.findUnique({
    where: { inviteCode: code.trim().toUpperCase() },
    include: { _count: { select: { members: true } } },
  });
  if (!league)
    throw new PaperGamePhaseTwoError("League invite code not found.", 404);
  if (league._count.members >= league.maxMembers)
    throw new PaperGamePhaseTwoError("This private league is full.");
  try {
    return await prisma.paperLeagueMember.create({
      data: {
        leagueId: league.id,
        userId,
        nickname: nickname?.trim().slice(0, 30) || null,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new PaperGamePhaseTwoError("You have already joined this league.");
    throw error;
  }
}

export async function leavePaperLeague(userId: string, leagueId: string) {
  const member = await prisma.paperLeagueMember.findUnique({
    where: { leagueId_userId: { leagueId, userId } },
    include: { league: true },
  });
  if (!member)
    throw new PaperGamePhaseTwoError("League membership not found.", 404);
  if (member.league.ownerUserId === userId)
    throw new PaperGamePhaseTwoError(
      "League owners cannot leave. Transfer ownership or delete the league in a future update.",
    );
  await prisma.paperLeagueMember.delete({ where: { id: member.id } });
}

export async function listPaperLeagues(userId: string) {
  return prisma.paperLeague.findMany({
    where: { members: { some: { userId } } },
    include: {
      members: { select: { userId: true, nickname: true, joinedAt: true } },
      _count: { select: { members: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

async function latestScoreRows(userIds?: string[]) {
  const latest = await prisma.paperAlphaScoreSnapshot.findMany({
    where: userIds ? { userId: { in: userIds } } : {},
    orderBy: [{ timestamp: "desc" }],
    distinct: ["userId"],
    take: 250,
  });
  const profiles = await prisma.paperGameProfile.findMany({
    where: { userId: { in: latest.map((item) => item.userId) } },
    select: {
      userId: true,
      currentLevel: true,
      totalChallengesCompleted: true,
    },
  });
  const profileByUser = new Map(
    profiles.map((profile) => [profile.userId, profile]),
  );
  return latest.map((score) => ({
    userId: score.userId,
    alphaScore: score.totalScore,
    challengePoints:
      (profileByUser.get(score.userId)?.totalChallengesCompleted ?? 0) * 20,
    level: profileByUser.get(score.userId)?.currentLevel ?? 1,
  }));
}

export async function leaderboard(userId: string, scope = "GLOBAL") {
  const allowedScopes = new Set(["GLOBAL", "LEAGUE"]);
  if (!allowedScopes.has(scope))
    throw new PaperGamePhaseTwoError("Leaderboard scope is not supported.");
  const rows = await latestScoreRows();
  return rankLeaderboardRows(rows, userId);
}

export async function listPublicCompetitions(userId: string) {
  await ensurePublicCompetitionCatalog();
  const competitions = await prisma.paperCompetition.findMany({
    where: { status: { in: ["UPCOMING", "OPEN", "ACTIVE"] } },
    include: {
      entries: { where: { userId }, select: { id: true, status: true } },
    },
    orderBy: { startsAt: "asc" },
    take: 50,
  });
  return competitions.map((competition) => ({
    ...competition,
    entered: Boolean(competition.entries[0]),
  }));
}

export async function enterPaperCompetition(
  userId: string,
  competitionId: string,
  paperPortfolioId: string,
) {
  const [competition, portfolio] = await Promise.all([
    prisma.paperCompetition.findFirst({
      where: { id: competitionId, status: "OPEN" },
    }),
    prisma.paperPortfolio.findFirst({
      where: { id: paperPortfolioId, userId },
    }),
  ]);
  if (!competition)
    throw new PaperGamePhaseTwoError(
      "This free competition is not open for entry.",
      400,
    );
  if (!portfolio)
    throw new PaperGamePhaseTwoError(
      "Select one of your simulated portfolios.",
      404,
    );
  if (!portfolio.startingCashUSD.eq(competition.startingCashUSD))
    throw new PaperGamePhaseTwoError(
      "This competition requires a $100,000 simulated starting portfolio.",
    );
  if (new Date() >= competition.startsAt)
    throw new PaperGamePhaseTwoError("Competition entry has closed.");
  try {
    return await prisma.paperCompetitionEntry.create({
      data: { competitionId, userId, paperPortfolioId },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new PaperGamePhaseTwoError(
        "You are already entered in this competition.",
      );
    throw error;
  }
}
