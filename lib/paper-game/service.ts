import { Prisma, type PaperXPSourceType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { levelForXP } from "@/lib/paper-game/levels";
import { PAPER_ACHIEVEMENTS } from "@/lib/paper-game/achievements";
import { ALPHA_SCORE_POLICY_VERSION, calculateAlphaScore } from "@/lib/paper-game/alpha-score";
import { getCachedPaperQuote } from "@/lib/market-data/paper-quote";

const startOfDay = (date = new Date()) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const startOfWeek = (date = new Date()) => { const day = startOfDay(date); day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7)); return day; };

const challengeTemplates = [
  { key: "DAILY_REVIEW", cadence: "DAILY" as const, title: "Portfolio check-in", description: "Review your simulated portfolio and its risk context.", criteriaKey: "REVIEW", xpReward: 20 },
  { key: "WEEKLY_THREE_POSITIONS", cadence: "WEEKLY" as const, title: "Build deliberately", description: "Hold at least three simulated positions this week.", criteriaKey: "POSITION_COUNT_3", xpReward: 75 },
];

export async function ensurePaperGameCatalog(now = new Date()) {
  await Promise.all(PAPER_ACHIEVEMENTS.map((achievement) => prisma.paperAchievement.upsert({ where: { key: achievement.key }, create: achievement, update: achievement })));
  for (const template of challengeTemplates) {
    const startsAt = template.cadence === "DAILY" ? startOfDay(now) : startOfWeek(now);
    const endsAt = new Date(startsAt); endsAt.setUTCDate(endsAt.getUTCDate() + (template.cadence === "DAILY" ? 1 : 7));
    await prisma.paperChallenge.upsert({ where: { key_startsAt: { key: template.key, startsAt } }, create: { ...template, startsAt, endsAt }, update: { endsAt, status: "ACTIVE" } });
  }
}

export async function awardPaperXP(input: { userId: string; sourceType: PaperXPSourceType; sourceId: string; xpAmount: number; reason: string }) {
  try {
    return await prisma.$transaction(async (tx) => {
      const event = await tx.paperXPEvent.create({ data: input });
      const profile = await tx.paperGameProfile.upsert({ where: { userId: input.userId }, create: { userId: input.userId, totalXP: input.xpAmount, currentLevel: levelForXP(input.xpAmount) }, update: { totalXP: { increment: input.xpAmount } } });
      const totalXP = profile.totalXP;
      const level = levelForXP(totalXP);
      const updated = await tx.paperGameProfile.update({ where: { userId: input.userId }, data: { currentLevel: level } });
      return { awarded: true, event, profile: updated };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { awarded: false };
    throw error;
  }
}

export async function recordMeaningfulPaperActivity(userId: string, sourceId: string) {
  const today = startOfDay();
  const streak = await prisma.paperUserStreak.findUnique({ where: { userId } });
  if (streak?.lastQualifyingDate?.valueOf() === today.valueOf()) return streak;
  const yesterday = new Date(today); yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const current = streak?.lastQualifyingDate?.valueOf() === yesterday.valueOf() ? streak.currentStreak + 1 : 1;
  const next = await prisma.paperUserStreak.upsert({ where: { userId }, create: { userId, lastQualifyingDate: today, currentStreak: current, longestStreak: current }, update: { lastQualifyingDate: today, currentStreak: current, longestStreak: Math.max(streak?.longestStreak ?? 0, current) } });
  await prisma.paperGameProfile.upsert({ where: { userId }, create: { userId, currentStreak: current, longestStreak: current }, update: { currentStreak: current, longestStreak: Math.max(streak?.longestStreak ?? 0, current) } });
  if (current === 7) await awardPaperXP({ userId, sourceType: "STREAK_MILESTONE", sourceId: `${sourceId}:seven-day`, xpAmount: 50, reason: "Seven days of meaningful paper-portfolio learning" });
  return next;
}

async function gameFacts(userId: string) {
  const [portfolios, transactions, streak] = await Promise.all([
    prisma.paperPortfolio.findMany({ where: { userId }, include: { positions: true, snapshots: { orderBy: { timestamp: "asc" } } } }),
    prisma.paperTransaction.findMany({ where: { paperPortfolio: { userId } }, select: { type: true } }),
    prisma.paperUserStreak.findUnique({ where: { userId } }),
  ]);
  return { portfolios, transactions, streak };
}

export async function evaluatePaperAchievements(userId: string) {
  await ensurePaperGameCatalog();
  const facts = await gameFacts(userId);
  const checks: Record<string, boolean> = {
    PORTFOLIO_COUNT_1: facts.portfolios.length >= 1,
    BUY_COUNT_1: facts.transactions.some((transaction) => transaction.type === "BUY"),
    SELL_COUNT_1: facts.transactions.some((transaction) => transaction.type === "SELL"),
    POSITION_COUNT_5: facts.portfolios.some((portfolio) => portfolio.positions.length >= 5),
    STREAK_7: (facts.streak?.currentStreak ?? 0) >= 7,
  };
  const unlocked: string[] = [];
  for (const definition of PAPER_ACHIEVEMENTS) {
    if (!checks[definition.criteriaKey]) continue;
    const achievement = await prisma.paperAchievement.findUniqueOrThrow({ where: { key: definition.key } });
    try {
      await prisma.paperUserAchievement.create({ data: { userId, achievementId: achievement.id } });
      await prisma.paperGameProfile.upsert({ where: { userId }, create: { userId, totalAchievementsUnlocked: 1 }, update: { totalAchievementsUnlocked: { increment: 1 } } });
      await awardPaperXP({ userId, sourceType: "ACHIEVEMENT_UNLOCKED", sourceId: achievement.id, xpAmount: achievement.xpReward, reason: `Achievement unlocked: ${achievement.name}` });
      unlocked.push(achievement.key);
    } catch (error) { if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error; }
  }
  return unlocked;
}

export async function evaluatePaperChallenges(userId: string, reviewed = false) {
  await ensurePaperGameCatalog();
  const now = new Date();
  const active = await prisma.paperChallenge.findMany({ where: { status: "ACTIVE", startsAt: { lte: now }, endsAt: { gt: now } } });
  const portfolios = await prisma.paperPortfolio.findMany({ where: { userId }, include: { positions: true } });
  const completed: string[] = [];
  for (const challenge of active) {
    const fulfilled = challenge.criteriaKey === "REVIEW" ? reviewed : challenge.criteriaKey === "POSITION_COUNT_3" ? portfolios.some((portfolio) => portfolio.positions.length >= 3) : false;
    const participation = await prisma.paperChallengeParticipation.upsert({ where: { userId_challengeId: { userId, challengeId: challenge.id } }, create: { userId, challengeId: challenge.id, progress: fulfilled ? 100 : 0, status: fulfilled ? "COMPLETED" : "IN_PROGRESS", completedAt: fulfilled ? now : null }, update: fulfilled ? { progress: 100, status: "COMPLETED", completedAt: now } : {} });
    if (fulfilled && participation.status === "COMPLETED") {
      const award = await awardPaperXP({ userId, sourceType: "CHALLENGE_COMPLETED", sourceId: challenge.id, xpAmount: challenge.xpReward, reason: `Challenge completed: ${challenge.title}` });
      if (award.awarded) { await prisma.paperGameProfile.update({ where: { userId }, data: { totalChallengesCompleted: { increment: 1 } } }); completed.push(challenge.key); }
    }
  }
  return completed;
}

export async function refreshPaperAlphaScore(userId: string, paperPortfolioId: string) {
  const portfolio = await prisma.paperPortfolio.findFirst({ where: { id: paperPortfolioId, userId }, include: { positions: true, snapshots: { orderBy: { timestamp: "asc" } } } });
  if (!portfolio) return null;
  const quotes = await Promise.all(portfolio.positions.map((position) => getCachedPaperQuote(position.ticker)));
  if (quotes.some((quote) => !quote)) return null;
  const positionValues = portfolio.positions.map((position, index) => position.shares.mul(new Prisma.Decimal(quotes[index]!.price)).toString());
  const transactionTotals = await prisma.paperTransaction.findMany({ where: { paperPortfolioId }, select: { type: true, shares: true, priceAtAction: true } });
  const cash = transactionTotals.reduce((total, transaction) => transaction.type === "BUY" ? total.minus(transaction.shares.mul(transaction.priceAtAction)) : total.plus(transaction.shares.mul(transaction.priceAtAction)), portfolio.startingCashUSD);
  const total = cash.plus(positionValues.reduce((sum, value) => sum.plus(value), new Prisma.Decimal(0)));
  const completed = await prisma.paperChallengeParticipation.count({ where: { userId, status: "COMPLETED" } });
  const score = calculateAlphaScore({ startingCash: portfolio.startingCashUSD.toString(), currentValue: total.toString(), values: [...portfolio.snapshots.map((snapshot) => snapshot.totalValueUSD.toString()), total.toString()], positionValues, completedChallenges: completed });
  const saved = await prisma.paperAlphaScoreSnapshot.create({ data: { userId, paperPortfolioId, totalScore: score.total, performanceScore: score.performance, drawdownScore: score.drawdown, diversificationScore: score.diversification, consistencyScore: score.consistency, challengeScore: score.challenge, policyVersion: ALPHA_SCORE_POLICY_VERSION, dataCoverage: new Prisma.Decimal(score.coverage).div(100), assumptions: score.assumptions } });
  const profile = await prisma.paperGameProfile.findUnique({ where: { userId }, select: { highestAlphaScore: true } });
  const highest = profile?.highestAlphaScore && profile.highestAlphaScore.gt(score.total) ? profile.highestAlphaScore : new Prisma.Decimal(score.total);
  await prisma.paperGameProfile.upsert({ where: { userId }, create: { userId, currentAlphaScore: score.total, highestAlphaScore: score.total }, update: { currentAlphaScore: score.total, highestAlphaScore: highest } });
  return saved;
}

export async function paperGameOverview(userId: string) {
  await ensurePaperGameCatalog();
  const now = new Date();
  const [profile, streak, achievements, challenges] = await Promise.all([
    prisma.paperGameProfile.upsert({ where: { userId }, create: { userId }, update: {} }),
    prisma.paperUserStreak.findUnique({ where: { userId } }),
    prisma.paperUserAchievement.findMany({ where: { userId }, include: { achievement: true }, orderBy: { earnedAt: "desc" }, take: 6 }),
    prisma.paperChallenge.findMany({ where: { status: "ACTIVE", startsAt: { lte: now }, endsAt: { gt: now } }, include: { participants: { where: { userId }, take: 1 } }, orderBy: { endsAt: "asc" } }),
  ]);
  return { profile, streak, level: levelForXP(profile.totalXP), achievements, challenges: challenges.map((challenge) => ({ ...challenge, participation: challenge.participants[0] ?? null })) };
}

export async function processPaperGameJobs(limit = 25) {
  await ensurePaperGameCatalog();
  const portfolios = await prisma.paperPortfolio.findMany({ select: { id: true, userId: true }, take: limit, orderBy: { updatedAt: "desc" } });
  let scored = 0;
  for (const portfolio of portfolios) {
    await evaluatePaperChallenges(portfolio.userId).catch(() => undefined);
    const snapshot = await refreshPaperAlphaScore(portfolio.userId, portfolio.id).catch(() => null);
    if (snapshot) scored += 1;
  }
  return { processed: portfolios.length, scored };
}

export async function recordPaperPortfolioCreated(userId: string, portfolioId: string) { await awardPaperXP({ userId, sourceType: "PORTFOLIO_CREATED", sourceId: portfolioId, xpAmount: 50, reason: "Created a simulated portfolio" }); await recordMeaningfulPaperActivity(userId, portfolioId); await evaluatePaperAchievements(userId); }
export async function recordPaperTrade(userId: string, transactionId: string) { await awardPaperXP({ userId, sourceType: "TRADE_RECORDED", sourceId: transactionId, xpAmount: 25, reason: "Recorded a simulated trade" }); await recordMeaningfulPaperActivity(userId, transactionId); await evaluatePaperAchievements(userId); await evaluatePaperChallenges(userId); }
export async function recordPaperReview(userId: string) { const sourceId = `review:${startOfDay().toISOString()}`; await awardPaperXP({ userId, sourceType: "PORTFOLIO_REVIEW", sourceId, xpAmount: 10, reason: "Reviewed simulated portfolio" }); await recordMeaningfulPaperActivity(userId, sourceId); await evaluatePaperChallenges(userId, true); await evaluatePaperAchievements(userId); }
