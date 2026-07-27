import { NextResponse } from "next/server";
import { getEnvironmentStatus } from "@/lib/env.server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: "ok", services: getEnvironmentStatus() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error, "Service health check failed.", 503);
  }
}
