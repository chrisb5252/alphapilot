import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAppUser, UnauthorizedError } from "@/lib/current-user";
import { apiError } from "@/lib/api-error";
import { assertSameOrigin } from "@/lib/security/request-guards";
import {
  createPaperLeague,
  listPaperLeagues,
  PaperGamePhaseTwoError,
} from "@/lib/paper-game/phase-two-service";
const schema = z.object({
  name: z.string().trim().min(3).max(60),
  nickname: z.string().trim().max(30).optional(),
});
export async function GET() {
  try {
    const user = await getCurrentAppUser();
    return NextResponse.json({ leagues: await listPaperLeagues(user.id) });
  } catch (error) {
    return apiError(
      error,
      error instanceof UnauthorizedError
        ? "Sign in to view leagues."
        : "Unable to load leagues.",
      error instanceof UnauthorizedError ? 401 : 500,
    );
  }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentAppUser();
    const body = schema.parse(await request.json());
    const league = await createPaperLeague(user.id, body.name, body.nickname);
    return NextResponse.json({ league }, { status: 201 });
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
        : "Unable to create league.",
      status,
    );
  }
}
