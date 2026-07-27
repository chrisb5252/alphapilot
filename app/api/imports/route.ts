import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAppUser, UnauthorizedError } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { savePortfolioImport } from "@/lib/import/service";
import { apiError } from "@/lib/api-error";

const row = z.object({
  rowNumber: z.number().int(),
  symbol: z.string().max(15),
  companyName: z.string().max(180),
  sector: z.string().max(100),
  shares: z.number().nullable(),
  costBasis: z.number().nullable(),
  currentPrice: z.number().nullable(),
  marketValue: z.number().nullable(),
});
const bodySchema = z.object({
  portfolioId: z.string().optional(),
  portfolioName: z.string().max(80),
  broker: z.enum([
    "Robinhood",
    "Fidelity",
    "Charles Schwab",
    "Vanguard",
    "E*TRADE",
    "Webull",
    "Chase",
    "Custom CSV",
  ]),
  fileName: z.string().min(1).max(180),
  rawCsv: z.string().min(1).max(5_000_000),
  headers: z.array(z.string().max(200)).max(100),
  warnings: z.array(z.string().max(300)).max(100),
  rows: z.array(row).min(1).max(10_000),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentAppUser();
    const input = bodySchema.parse(await request.json());
    const result = await savePortfolioImport(prisma, {
      ...input,
      userId: user.id,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? "The import data was invalid. Please select the CSV again."
        : error instanceof Error
          ? error.message
          : "Unable to save this import.";
    return apiError(
      error,
      message,
      error instanceof UnauthorizedError ? 401 : 400,
    );
  }
}
export async function GET(request: Request) {
  try {
    const user = await getCurrentAppUser();
    const portfolioId = new URL(request.url).searchParams.get("portfolioId");
    const imports = await prisma.importHistory.findMany({
      where: {
        portfolio: { userId: user.id },
        ...(portfolioId ? { portfolioId } : {}),
      },
      include: { portfolio: { select: { name: true } } },
      orderBy: { importedAt: "desc" },
    });
    return NextResponse.json({
      imports: imports.map((entry) => ({
        ...entry,
        portfolioValue: Number(entry.portfolioValue),
      })),
    });
  } catch (error) {
    return apiError(
      error,
      "Unable to load import history.",
      error instanceof UnauthorizedError ? 401 : 500,
    );
  }
}
