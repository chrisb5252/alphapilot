import { getCurrentAppUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentAppUser();
  const { id } = await params;
  const item = await prisma.importHistory.findFirst({
    where: { id, portfolio: { userId: user.id } },
    include: { csvLog: true },
  });
  if (!item?.csvLog) return new Response("Import not found", { status: 404 });
  const filename = item.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return new Response(item.csvLog.rawCsv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
