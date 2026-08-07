import { NextResponse } from "next/server";
import { getCurrentAppUser, UnauthorizedError } from "@/lib/current-user";
import { apiError } from "@/lib/api-error";
import { assertRateLimit, assertSameOrigin } from "@/lib/security/request-guards";
import { recordPaperReview } from "@/lib/paper-game/service";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentAppUser();
    assertRateLimit(`paper-review:${user.id}`, 3, 60_000);
    await recordPaperReview(user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, error instanceof UnauthorizedError ? "Sign in to record a review." : "Unable to record your portfolio review.", error instanceof UnauthorizedError ? 401 : 500);
  }
}
