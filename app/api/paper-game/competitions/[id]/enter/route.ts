import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAppUser, UnauthorizedError } from "@/lib/current-user";
import { apiError } from "@/lib/api-error";
import { assertSameOrigin } from "@/lib/security/request-guards";
import {
  enterPaperCompetition,
  PaperGamePhaseTwoError,
} from "@/lib/paper-game/phase-two-service";
const schema = z.object({ paperPortfolioId: z.string().min(1) });
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentAppUser();
    const { id } = await params;
    const body = schema.parse(await request.json());
    const entry = await enterPaperCompetition(
      user.id,
      id,
      body.paperPortfolioId,
    );
    return NextResponse.json({ entry }, { status: 201 });
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
        : "Unable to enter competition.",
      status,
    );
  }
}
