import { NextResponse } from "next/server";
import { getCurrentAppUser, UnauthorizedError } from "@/lib/current-user";
import { apiError } from "@/lib/api-error";
import { listPublicCompetitions } from "@/lib/paper-game/phase-two-service";
export async function GET() {
  try {
    const user = await getCurrentAppUser();
    return NextResponse.json({
      competitions: await listPublicCompetitions(user.id),
    });
  } catch (error) {
    return apiError(
      error,
      error instanceof UnauthorizedError
        ? "Sign in to view competitions."
        : "Unable to load competitions.",
      error instanceof UnauthorizedError ? 401 : 500,
    );
  }
}
