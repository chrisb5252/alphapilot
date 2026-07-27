import { createHash } from "node:crypto";
import { Decimal } from "@prisma/client/runtime/client";
import type { PrismaClient } from "@/generated/prisma/client";
import { validateHolding } from "./csv";
import type { BrokerName, ImportPreviewRow } from "./types";

export function fingerprintCsv(rawCsv: string) {
  return createHash("sha256").update(rawCsv).digest("hex");
}

export function validatePreview(rows: ImportPreviewRow[]) {
  const seen = new Set<string>();
  return rows.map((row) => {
    const cleaned = {
      ...row,
      symbol: row.symbol.trim().toUpperCase(),
      companyName: row.companyName.trim(),
      sector: row.sector.trim(),
    };
    const result = validateHolding(cleaned);
    if (seen.has(cleaned.symbol))
      result.errors.push({
        field: "row",
        message: "Duplicate ticker in this import.",
      });
    seen.add(cleaned.symbol);
    return { ...cleaned, ...result };
  });
}

type SaveImportInput = {
  userId: string;
  portfolioId?: string;
  portfolioName: string;
  broker: BrokerName;
  fileName: string;
  rawCsv: string;
  headers: string[];
  warnings: string[];
  rows: ImportPreviewRow[];
};

export async function savePortfolioImport(
  db: PrismaClient,
  input: SaveImportInput,
) {
  const rows = validatePreview(input.rows);
  const invalidRows = rows.filter((row) => row.errors.length);
  if (invalidRows.length)
    throw new Error("Fix the highlighted rows before importing.");
  const fingerprint = fingerprintCsv(input.rawCsv);
  const portfolio = input.portfolioId
    ? await db.portfolio.findFirst({
        where: { id: input.portfolioId, userId: input.userId },
      })
    : await db.portfolio.create({
        data: {
          userId: input.userId,
          name: input.portfolioName.trim().slice(0, 80) || "My Portfolio",
        },
      });
  if (!portfolio) throw new Error("Portfolio not found.");
  const duplicate = await db.importHistory.findUnique({
    where: {
      portfolioId_fileFingerprint: {
        portfolioId: portfolio.id,
        fileFingerprint: fingerprint,
      },
    },
  });
  if (duplicate)
    throw new Error(
      "This exact CSV has already been imported into this portfolio.",
    );
  const value = rows.reduce(
    (total, row) => total.plus(new Decimal(row.marketValue ?? 0)),
    new Decimal(0),
  );
  return db.$transaction(async (tx) => {
    await tx.importHistory.updateMany({
      where: { portfolioId: portfolio.id, isActive: true },
      data: { isActive: false },
    });
    const imported = await tx.importHistory.create({
      data: {
        portfolioId: portfolio.id,
        broker: input.broker,
        fileName: input.fileName.slice(0, 180),
        fileFingerprint: fingerprint,
        holdingCount: rows.length,
        portfolioValue: value.toDecimalPlaces(4).toString(),
        isActive: true,
      },
    });
    await tx.importedHolding.createMany({
      data: rows.map((row) => ({
        portfolioId: portfolio.id,
        importId: imported.id,
        symbol: row.symbol,
        companyName: row.companyName || null,
        sector: row.sector || null,
        shares: row.shares!.toFixed(6),
        costBasis: row.costBasis?.toFixed(4) ?? null,
        currentPrice: row.currentPrice?.toFixed(4) ?? null,
        marketValue: (row.marketValue ?? 0).toFixed(4),
      })),
    });
    const account = await tx.investmentAccount.upsert({
      where: {
        userId_providerAccountId: {
          userId: input.userId,
          providerAccountId: `imported-${portfolio.id}`,
        },
      },
      create: {
        userId: input.userId,
        portfolioId: portfolio.id,
        providerAccountId: `imported-${portfolio.id}`,
        name: "Imported positions",
        accountType: "BROKERAGE",
        currency: portfolio.currency,
      },
      update: { isIncludedInAnalysis: true },
    });
    await tx.holding.deleteMany({ where: { accountId: account.id } });
    for (const row of rows) {
      const security = await tx.security.upsert({
        where: { canonicalSymbol: row.symbol },
        create: {
          canonicalSymbol: row.symbol,
          name: row.companyName || row.symbol,
          sector: row.sector || null,
        },
        update: {
          name: row.companyName || row.symbol,
          sector: row.sector || null,
        },
      });
      await tx.holding.create({
        data: {
          accountId: account.id,
          securityId: security.id,
          quantity: row.shares!.toFixed(10),
          averageCost: row.costBasis?.toFixed(10) ?? null,
          costBasis:
            row.costBasis === null
              ? null
              : new Decimal(row.costBasis)
                  .times(row.shares!)
                  .toDecimalPlaces(4)
                  .toString(),
          currentPrice: row.currentPrice?.toFixed(10) ?? null,
          marketValue: new Decimal(row.marketValue ?? 0)
            .toDecimalPlaces(4)
            .toString(),
          currency: portfolio.currency,
          asOfDate: new Date(),
          source: "CSV_IMPORT",
        },
      });
    }
    await tx.cSVImportLog.create({
      data: {
        importHistoryId: imported.id,
        rawCsv: input.rawCsv,
        detectedHeaders: input.headers,
        warnings: input.warnings,
        errorCount: 0,
      },
    });
    return { portfolioId: portfolio.id, importId: imported.id };
  });
}
