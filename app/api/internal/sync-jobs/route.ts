import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { secureEqual } from "@/lib/security/request-guards";
import { synchronizeConnection } from "@/lib/snaptrade/service";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || !authorization || !secureEqual(authorization, `Bearer ${secret}`)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const jobs = await prisma.syncJob.findMany({ where: { status: "PENDING", brokerageConnection: { provider: "SNAPTRADE", providerConnectionId: { not: null } } }, include: { brokerageConnection: true }, orderBy: { createdAt: "asc" }, take: 5 });
  let processed = 0;
  for (const job of jobs) {
    if (!job.brokerageConnection) continue;
    await prisma.syncJob.update({ where: { id: job.id }, data: { status: "RUNNING", startedAt: new Date() } });
    try { await synchronizeConnection(job.userId, job.brokerageConnection.id); await prisma.syncJob.update({ where: { id: job.id }, data: { status: "COMPLETED", completedAt: new Date() } }); processed += 1; }
    catch { await prisma.syncJob.update({ where: { id: job.id }, data: { status: "FAILED", completedAt: new Date(), errorMessage: "Provider synchronization failed. Review the brokerage connection status." } }); }
  }
  return NextResponse.json({ processed });
}
