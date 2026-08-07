import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAppUser, UnauthorizedError } from "@/lib/current-user";
import { apiError } from "@/lib/api-error";
import { assertSameOrigin } from "@/lib/security/request-guards";
import {
  joinPaperLeague,
  PaperGamePhaseTwoError,
} from "@/lib/paper-game/phase-two-service";
const schema = z.object({
  inviteCode: z.string().trim().min(6).max(32),
  nickname: z.string().trim().max(30).optional(),
});
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentAppUser();
    const body = schema.parse(await request.json());
    const membership = await joinPaperLeague(
      user.id,
      body.inviteCode,
      body.nickname,
    );
    return NextResponse.json({ membership }, { status: 201 });
  } catch (error) {
    const status =
      error instanceof UnauthorizedError
        ? 401
        : error instanceof PaperGamePhaseTwoError || error instanceof z.ZodError
          ? error instanceof PaperGamePhaseTwoError
            ? error.status
            : 400
          : 500;
    return apiError(
      error,
      error instanceof PaperGamePhaseTwoError || error instanceof z.ZodError
        ? error.message
        : "Unable to join league.",
      status,
    );
  }
}
