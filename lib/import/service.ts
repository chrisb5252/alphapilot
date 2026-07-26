import { createHash } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { validateHolding } from "./csv";
import type { BrokerName, ImportPreviewRow } from "./types";

export function fingerprintCsv(rawCsv: string) {
  return createHash("sha256").update(rawCsv).digest("hex");
}

export function validatePreview(rows: ImportPreviewRow[]) {
  const seen = new Set<string>();
  return rows.map((row) => {
    const cleaned = { ...row, symbol: row.symbol.trim().toUpperCase(), companyName: row.companyName.trim(), sector: row.sector.trim() };
    const result = validateHolding(cleaned);
    if (seen.has(cleaned.symbol)) result.errors.push({ field: "row", message: "Duplicate ticker in this import." });
    seen.add(cleaned.symbol);
    return { ...cleaned, ...result };
  });
}

type SaveImportInput = { userId: string; portfolioId?: string; portfolioName: string; broker: BrokerName; fileName: string; rawCsv: string; headers: string[]; warnings: string[]; rows: ImportPreviewRow[] };

export async function savePortfolioImport(db: PrismaClient, input: SaveImportInput) {
  const rows = validatePreview(input.rows);
  const invalidRows = rows.filter((row) => row.errors.length);
  if (invalidRows.length) throw new Error("Fix the highlighted rows before importing.");
  const fingerprint = fingerprintCsv(input.rawCsv);
  const portfolio = input.portfolioId
    ? await db.portfolio.findFirst({ where: { id: input.portfolioId, userId: input.userId } })
    : await db.portfolio.create({ data: { userId: input.userId, name: input.portfolioName.trim().slice(0, 80) || "My Portfolio" } });
  if (!portfolio) throw new Error("Portfolio not found.");
  const duplicate = await db.importHistory.findUnique({ where: { portfolioId_fileFingerprint: { portfolioId: portfolio.id, fileFingerprint: fingerprint } } });
  if (duplicate) throw new Error("This exact CSV has already been imported into this portfolio.");
  const value = rows.reduce((total, row) => total + (row.marketValue ?? 0), 0);
  return db.$transaction(async (tx) => {
    await tx.importHistory.updateMany({ where: { portfolioId: portfolio.id, isActive: true }, data: { isActive: false } });
    const imported = await tx.importHistory.create({ data: { portfolioId: portfolio.id, broker: input.broker, fileName: input.fileName.slice(0, 180), fileFingerprint: fingerprint, holdingCount: rows.length, portfolioValue: value.toFixed(4), isActive: true } });
    await tx.holding.createMany({ data: rows.map((row) => ({ portfolioId: portfolio.id, importId: imported.id, symbol: row.symbol, companyName: row.companyName || null, sector: row.sector || null, shares: row.shares!.toFixed(6), costBasis: row.costBasis?.toFixed(4) ?? null, currentPrice: row.currentPrice?.toFixed(4) ?? null, marketValue: (row.marketValue ?? 0).toFixed(4) })) });
    await tx.cSVImportLog.create({ data: { importHistoryId: imported.id, rawCsv: input.rawCsv, detectedHeaders: input.headers, warnings: input.warnings, errorCount: 0 } });
    return { portfolioId: portfolio.id, importId: imported.id };
  });
}
