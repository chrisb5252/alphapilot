import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentAppUser(); const { id } = await params;
    const item = await prisma.importHistory.findFirst({ where: { id, portfolio: { userId: user.id } } });
    if (!item) return NextResponse.json({ error: "Import not found." }, { status: 404 });
    await prisma.$transaction(async (tx) => { await tx.importHistory.delete({ where: { id } }); if (item.isActive) { const previous = await tx.importHistory.findFirst({ where: { portfolioId: item.portfolioId, status: "COMPLETED" }, orderBy: { importedAt: "desc" } }); if (previous) await tx.importHistory.update({ where: { id: previous.id }, data: { isActive: true } }); } });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Unable to delete import." }, { status: 500 }); }
}
