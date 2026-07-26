import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { parseChaseStatementText } from "@/lib/import/pdf";
import { parseChaseStatementTable } from "@/lib/import/pdf";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    await getCurrentAppUser(); const form = await request.formData(); const file = form.get("file");
    if (!(file instanceof File) || (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) || file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Upload a PDF statement no larger than 10 MB." }, { status: 400 });
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const items: { str: string; x: number; y: number }[] = []; let text = "";
    for (let page = 1; page <= document.numPages; page++) { const content = await (await document.getPage(page)).getTextContent(); for (const item of content.items) if ("str" in item) { text += `${item.str} `; items.push({ str: item.str, x: item.transform[4], y: item.transform[5] + page * 10000 }); } }
    const output = parseChaseStatementTable(items).result.rows.length ? parseChaseStatementTable(items) : parseChaseStatementText(text); return NextResponse.json(output);
  } catch (error) {
    const details = error instanceof Error ? error.message.toLowerCase() : "";
    const message = details.includes("password") || details.includes("encrypted")
      ? "This Chase PDF is password-protected. Download an unlocked statement from Chase, then try again."
      : "We could not extract text from this PDF. It may be a scanned image or a protected statement. Try the most recent Chase statement PDF, downloaded directly from Chase.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
