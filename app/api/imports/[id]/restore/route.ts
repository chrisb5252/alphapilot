import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const user = await getCurrentAppUser(); const { id } = await params; const item = await prisma.importHistory.findFirst({ where: { id, portfolio: { userId: user.id } } }); if (!item) return NextResponse.json({ error: "Import not found." }, { status: 404 }); await prisma.$transaction([prisma.importHistory.updateMany({ where: { portfolioId: item.portfolioId }, data: { isActive: false } }), prisma.importHistory.update({ where: { id }, data: { isActive: true } })]); return NextResponse.json({ ok: true }); } catch { return NextResponse.json({ error: "Unable to restore import." }, { status: 500 }); }
}
