import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { secureEqual } from "@/lib/security/request-guards";

export const runtime = "nodejs";
const eventSchema = (value: unknown): { webhookId: string; eventType: string; eventTimestamp: string; userId?: string; brokerageAuthorizationId?: string } | null => {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  return typeof data.webhookId === "string" && typeof data.eventType === "string" && typeof data.eventTimestamp === "string" ? { webhookId: data.webhookId, eventType: data.eventType, eventTimestamp: data.eventTimestamp, userId: typeof data.userId === "string" ? data.userId : undefined, brokerageAuthorizationId: typeof data.brokerageAuthorizationId === "string" ? data.brokerageAuthorizationId : undefined } : null;
};
function canonicalize(value: unknown): string { if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`; if (value && typeof value === "object") { const object = value as Record<string, unknown>; return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(object[key])}`).join(",")}}`; } return JSON.stringify(value); }

export async function POST(request: Request) {
  const raw = await request.text(); const signature = request.headers.get("signature"); const key = process.env.SNAPTRADE_CONSUMER_KEY;
  let payload: unknown; try { payload = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const event = eventSchema(payload);
  if (!key || !signature || !event) return NextResponse.json({ error: "Unauthorized webhook." }, { status: 401 });
  const expected = crypto.createHmac("sha256", key).update(canonicalize(payload)).digest("base64");
  if (!secureEqual(signature, expected)) return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  const timestamp = new Date(event.eventTimestamp); if (Number.isNaN(timestamp.valueOf()) || Math.abs(Date.now() - timestamp.valueOf()) > 5 * 60_000) return NextResponse.json({ error: "Expired webhook." }, { status: 400 });
  const connection = event.brokerageAuthorizationId ? await prisma.brokerageConnection.findFirst({ where: { provider: "SNAPTRADE", providerConnectionId: event.brokerageAuthorizationId } }) : null;
  try {
    await prisma.webhookEvent.create({ data: { provider: "SNAPTRADE", providerEventId: event.webhookId, eventType: event.eventType, providerUserId: event.userId, brokerageConnectionId: connection?.id, payloadHash: crypto.createHash("sha256").update(raw).digest("hex"), status: "RECEIVED" } });
  } catch { return NextResponse.json({ ok: true, duplicate: true }); }
  if (connection && ["ACCOUNT_HOLDINGS_UPDATED", "ACCOUNT_TRANSACTIONS_UPDATED", "CONNECTION_ADDED", "CONNECTION_FIXED", "CONNECTION_UPDATED"].includes(event.eventType)) { await prisma.$transaction([prisma.syncJob.create({ data: { userId: connection.userId, brokerageConnectionId: connection.id, status: "PENDING" } }), prisma.webhookEvent.update({ where: { provider_providerEventId: { provider: "SNAPTRADE", providerEventId: event.webhookId } }, data: { status: "QUEUED", processedAt: new Date() } })]); }
  if (connection && event.eventType === "CONNECTION_BROKEN") await prisma.brokerageConnection.update({ where: { id: connection.id }, data: { status: "REAUTH_REQUIRED", safeErrorMessage: "This brokerage needs to be repaired." } });
  if (connection && event.eventType === "CONNECTION_DELETED") await prisma.brokerageConnection.update({ where: { id: connection.id }, data: { status: "DISCONNECTED" } });
  return NextResponse.json({ ok: true });
}
