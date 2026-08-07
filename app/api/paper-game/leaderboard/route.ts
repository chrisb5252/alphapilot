import { NextResponse } from "next/server";
import { getCurrentAppUser, UnauthorizedError } from "@/lib/current-user";
import { apiError } from "@/lib/api-error";
import { leaderboard } from "@/lib/paper-game/phase-two-service";
export async function GET(request: Request) {
  try {
    const user = await getCurrentAppUser();
    const scope = new URL(request.url).searchParams.get("scope") ?? "GLOBAL";
    return NextResponse.json({ rows: await leaderboard(user.id, scope) });
  } catch (error) {
    return apiError(
      error,
      error instanceof UnauthorizedError
        ? "Sign in to view leaderboard."
        : "Unable to load leaderboard.",
      error instanceof UnauthorizedError ? 401 : 500,
    );
  }
}
