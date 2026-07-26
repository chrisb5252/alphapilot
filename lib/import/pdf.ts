import { parsePortfolioCsv } from "./csv";
type PdfItem = { str: string; x: number; y: number };

/** Reads JPMorgan's statement table by physical column, rather than unreliable PDF text order. */
export function parseChaseStatementTable(items: PdfItem[]) {
  const lines = new Map<number, PdfItem[]>();
  for (const item of items) { const y = Math.round(item.y / 3) * 3; lines.set(y, [...(lines.get(y) ?? []), item]); }
  const ordered = [...lines.entries()].sort((a, b) => b[0] - a[0]).map(([y, cells]) => ({ y, cells: cells.sort((a, b) => a.x - b.x) }));
  const rows: string[] = ["Symbol,Company,Shares,Market Value"];
  for (const line of ordered) {
    const description = line.cells.filter(cell => cell.x < 150).map(cell => cell.str).join(" ").replace(/\s+/g, " ").trim();
    const quantity = line.cells.filter(cell => cell.x >= 265 && cell.x < 310).map(cell => cell.str).join("").replace(/,/g, "");
    const value = line.cells.filter(cell => cell.x >= 360 && cell.x < 425).map(cell => cell.str).join("").replace(/,/g, "");
    if (!description || !/^\d+(?:\.\d+)?$/.test(quantity) || !/^\d+(?:\.\d+)?$/.test(value)) continue;
    const symbolLine = ordered.find(candidate => candidate.y < line.y && line.y - candidate.y < 80 && /Symbol:/i.test(candidate.cells.map(cell => cell.str).join(" ")));
    const symbol = symbolLine?.cells.map(cell => cell.str).join(" ").match(/Symbol:\s*([A-Z][A-Z0-9.\-]{0,14})/i)?.[1]?.toUpperCase();
    if (symbol) rows.push([symbol, `"${description.replace(/"/g, '""')}"`, quantity, value].join(","));
  }
  const result = parsePortfolioCsv(rows.join("\n")); result.broker = "Chase";
  if (!result.rows.length) result.fileErrors.push("We found the statement but could not identify its holdings rows. Please contact support with a redacted copy.");
  result.warnings.unshift("Positions were extracted from the Chase statement table. Review every row before approving.");
  return { result, normalizedCsv: rows.join("\n") };
}
export function parseChaseStatementText(text: string) {
  const rows = ["Symbol,Company,Shares,Market Value"];
  for (const line of text.replace(/\r/g, "").split("\n").map(x => x.replace(/\s+/g, " ").trim())) {
    const match = line.match(/^([A-Z][A-Z0-9.\-]{0,14})\s+(.+?)\s+(\d[\d,]*(?:\.\d+)?)\s+\$?([\d,]+(?:\.\d{2})?)$/);
    if (match) rows.push([match[1], `"${match[2].replace(/"/g, '""')}"`, match[3].replace(/,/g, ""), match[4].replace(/,/g, "")].join(","));
  }
  const result = parsePortfolioCsv(rows.join("\n")); result.broker = "Chase";
  if (!result.rows.length) result.fileErrors.push("We could not reliably find holdings in this PDF. Use a current Chase positions statement, or upload a CSV.");
  result.warnings.unshift("PDF values were extracted from a Chase statement. Review every row before approving.");
  return { result, normalizedCsv: rows.join("\n") };
}
