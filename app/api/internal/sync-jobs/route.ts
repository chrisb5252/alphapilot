import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { secureEqual } from "@/lib/security/request-guards";
import { synchronizeConnection } from "@/lib/snaptrade/service";
import { processMarketDataJobs } from "@/lib/market-data/jobs";
import { createDailyPaperSnapshots } from "@/lib/paper-trading/service";
import { processPaperGameJobs } from "@/lib/paper-game/service";

async function processJobs(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (
    !secret ||
    !authorization ||
    !secureEqual(authorization, `Bearer ${secret}`)
  )
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const jobs = await prisma.syncJob.findMany({
    where: {
      status: "PENDING",
      brokerageConnection: {
        provider: "SNAPTRADE",
        providerConnectionId: { not: null },
      },
    },
    include: { brokerageConnection: true },
    orderBy: { createdAt: "asc" },
    take: 5,
  });
  let processed = 0;
  for (const job of jobs) {
    if (!job.brokerageConnection) continue;
    await prisma.syncJob.update({
      where: { id: job.id },
      data: { status: "RUNNING", startedAt: new Date() },
    });
    try {
      await synchronizeConnection(job.userId, job.brokerageConnection.id);
      await prisma.syncJob.update({
        where: { id: job.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      processed += 1;
    } catch {
      await prisma.syncJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          errorMessage:
            "Provider synchronization failed. Review the brokerage connection status.",
        },
      });
    }
  }
  // The Hobby cron runs once daily. Keep market-data work bounded so it cannot
  // starve connection syncs or exhaust a provider's request budget.
  const marketData = await processMarketDataJobs(4);
  const paperSnapshots = await createDailyPaperSnapshots();
  const paperGame = await processPaperGameJobs(25);
  return NextResponse.json({ processed, marketData, paperSnapshots, paperGame });
}

// Vercel Cron invokes the configured path with GET. POST remains useful for a
// manually triggered authenticated worker in non-Vercel environments.
export async function GET(request: Request) {
  return processJobs(request);
}
export async function POST(request: Request) {
  return processJobs(request);
}
