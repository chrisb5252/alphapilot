import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { parseChaseStatementText } from "@/lib/import/pdf";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try { await getCurrentAppUser(); const form = await request.formData(); const file = form.get("file"); if (!(file instanceof File) || file.type !== "application/pdf" || file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Upload a PDF statement no larger than 10 MB." }, { status: 400 }); const pdf = (await import("pdf-parse/lib/pdf-parse.js")).default; const output = parseChaseStatementText((await pdf(Buffer.from(await file.arrayBuffer()))).text); return NextResponse.json(output); }
  catch { return NextResponse.json({ error: "We could not read this PDF. Upload an unlocked Chase statement PDF and try again." }, { status: 400 }); }
}
