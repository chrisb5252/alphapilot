import { NextResponse } from "next/server";
import { getCurrentAppUser, UnauthorizedError } from "@/lib/current-user";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { assertRateLimit, assertSameOrigin } from "@/lib/security/request-guards";
import { createConnectionPortal, ensureSnapTradeUser, synchronizeConnection } from "@/lib/snaptrade/service";
import { snaptradeClient } from "@/lib/snaptrade/client";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request); const user = await getCurrentAppUser(); const { id } = await params; const connection = await prisma.brokerageConnection.findFirst({ where: { id, userId: user.id, provider: "SNAPTRADE" } }); if (!connection?.providerConnectionId) return NextResponse.json({ error: "Connection not found." }, { status: 404 });
    const providerConnectionId = connection.providerConnectionId; assertRateLimit(`snaptrade-refresh:${user.id}:${id}`, 1, 60_000); const body = await request.json();
    if (body.action === "repair") return NextResponse.json({ portalUrl: await createConnectionPortal(user.id, undefined, providerConnectionId) });
    if (body.action === "refresh") { const credentials = await ensureSnapTradeUser(user.id); await snaptradeClient().connections.refreshBrokerageAuthorization({ authorizationId: providerConnectionId, userId: credentials.providerUserId, userSecret: credentials.userSecret }); await prisma.brokerageConnection.update({ where: { id }, data: { status: "REFRESHING", lastAttemptedSyncAt: new Date() } }); return NextResponse.json({ accepted: true, message: "Refresh requested. Data updates when SnapTrade finishes its asynchronous sync." }); }
    if (body.action === "sync") return NextResponse.json(await synchronizeConnection(user.id, id));
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) { return apiError(error, "Unable to update this brokerage connection.", error instanceof UnauthorizedError ? 401 : 400); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request); const user = await getCurrentAppUser(); const { id } = await params; const input = await request.json(); if (input.confirmation !== "DISCONNECT") return NextResponse.json({ error: "Type DISCONNECT to confirm." }, { status: 400 });
    const connection = await prisma.brokerageConnection.findFirst({ where: { id, userId: user.id, provider: "SNAPTRADE" }, include: { accounts: true } }); if (!connection?.providerConnectionId) return NextResponse.json({ error: "Connection not found." }, { status: 404 });
    const providerConnectionId = connection.providerConnectionId; const credentials = await ensureSnapTradeUser(user.id); await snaptradeClient().connections.deleteConnection({ connectionId: providerConnectionId, userId: credentials.providerUserId, userSecret: credentials.userSecret });
    await prisma.$transaction([prisma.holding.deleteMany({ where: { account: { brokerageConnectionId: id } } }), prisma.cashBalance.deleteMany({ where: { account: { brokerageConnectionId: id } } }), prisma.investmentTransaction.deleteMany({ where: { account: { brokerageConnectionId: id } } }), prisma.investmentAccount.deleteMany({ where: { brokerageConnectionId: id } }), prisma.brokerageConnection.update({ where: { id }, data: { status: "DISCONNECTED" } })]);
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error, "Unable to disconnect this brokerage.", error instanceof UnauthorizedError ? 401 : 400); }
}
