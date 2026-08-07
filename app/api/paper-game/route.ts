import { NextResponse } from "next/server";
import { getCurrentAppUser, UnauthorizedError } from "@/lib/current-user";
import { apiError } from "@/lib/api-error";
import { paperGameOverview } from "@/lib/paper-game/service";

export async function GET() {
  try {
    const user = await getCurrentAppUser();
    const game = await paperGameOverview(user.id);
    return NextResponse.json({ game: {
      profile: { totalXP: game.profile.totalXP, currentLevel: game.level, currentStreak: game.streak?.currentStreak ?? 0, alphaScore: game.profile.currentAlphaScore?.toString() ?? null },
      achievements: game.achievements.map((item) => ({ key: item.achievement.key, name: item.achievement.name, category: item.achievement.category, xpReward: item.achievement.xpReward, earnedAt: item.earnedAt })),
      challenges: game.challenges.map((item) => ({ id: item.id, title: item.title, description: item.description, cadence: item.cadence, xpReward: item.xpReward, endsAt: item.endsAt, status: item.participation?.status ?? "IN_PROGRESS", progress: item.participation?.progress ?? 0 })),
    } });
  } catch (error) {
    return apiError(error, error instanceof UnauthorizedError ? "Sign in to access paper-game progress." : "Unable to load paper-game progress.", error instanceof UnauthorizedError ? 401 : 500);
  }
}
