import { NextResponse } from "next/server";

export function apiError(error: unknown, message: string, status = 500) {
  const requestId = crypto.randomUUID();
  console.error(
    JSON.stringify({
      event: "api_error",
      requestId,
      status,
      message,
      error: error instanceof Error ? error.message : String(error),
    }),
  );
  return NextResponse.json({ error: message, requestId }, { status });
}
