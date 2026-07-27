import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAppUser, UnauthorizedError } from "@/lib/current-user";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/security/request-guards";
const schema = z.object({
  localName: z.string().trim().min(1).max(80).nullable().optional(),
  isIncludedInAnalysis: z.boolean().optional(),
});
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentAppUser();
    const { id } = await params;
    const input = schema.parse(await request.json());
    const account = await prisma.investmentAccount.updateMany({
      where: { id, userId: user.id },
      data: input,
    });
    if (!account.count)
      return NextResponse.json(
        { error: "Account not found." },
        { status: 404 },
      );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(
      error,
      "Unable to update this account.",
      error instanceof UnauthorizedError ? 401 : 400,
    );
  }
}
