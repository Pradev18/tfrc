import { NextRequest, NextResponse } from "next/server";
import { readOwnerReportPdf } from "@/lib/report/owner-report-pdf-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  const pdf = await readOwnerReportPdf(token);
  if (!pdf) {
    return NextResponse.json({ error: "Report copy not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="TFRC-report.pdf"',
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
