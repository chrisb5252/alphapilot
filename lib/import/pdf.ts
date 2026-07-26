import { parsePortfolioCsv } from "./csv";
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
