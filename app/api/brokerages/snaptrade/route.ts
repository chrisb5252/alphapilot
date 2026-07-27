import { NextResponse } from "next/server";
import { getCurrentAppUser, UnauthorizedError } from "@/lib/current-user";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { assertRateLimit, assertSameOrigin } from "@/lib/security/request-guards";
import { createConnectionPortal, ensureSnapTradeUser, syncSnapTradeConnections } from "@/lib/snaptrade/service";
import { snaptradeClient, snaptradeEnabled, snaptradeIsTestEnvironment } from "@/lib/snaptrade/client";

export async function GET() {
  try {
    const user = await getCurrentAppUser();
    const connections = await prisma.brokerageConnection.findMany({ where: { userId: user.id, provider: "SNAPTRADE", providerConnectionId: { not: null } }, include: { accounts: true }, orderBy: { updatedAt: "desc" } });
    let brokerages: unknown[] = [];
    if (snaptradeEnabled()) { const response = await snaptradeClient().referenceData.getPartnerInfo(); const data = response.data as { allowed_brokerages?: unknown[] }; brokerages = data.allowed_brokerages ?? []; }
    return NextResponse.json({ configured: snaptradeEnabled(), testEnvironment: snaptradeIsTestEnvironment(), connections, brokerages });
  } catch (error) { return apiError(error, "Unable to load brokerage connections.", error instanceof UnauthorizedError ? 401 : 500); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request); const user = await getCurrentAppUser(); assertRateLimit(`snaptrade:${user.id}`, 5);
    const body = await request.json().catch(() => ({}));
    if (body.action === "register") { await ensureSnapTradeUser(user.id); return NextResponse.json({ ok: true }); }
    if (body.action === "sync") return NextResponse.json({ connections: await syncSnapTradeConnections(user.id) });
    if (body.action === "connect") { const portalUrl = await createConnectionPortal(user.id, typeof body.broker === "string" ? body.broker : undefined); return NextResponse.json({ portalUrl }); }
    return NextResponse.json({ error: "Unsupported brokerage action." }, { status: 400 });
  } catch (error) { return apiError(error, error instanceof Error ? error.message : "Unable to start brokerage connection.", error instanceof UnauthorizedError ? 401 : 400); }
}
