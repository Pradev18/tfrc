import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getOfficeReportDetailForPdf } from "@/services/office-report.service";
import { buildOfficeReportPdfHtml } from "@/lib/report/office-report-pdf-html";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Sample preview only (first 50 unique rows) so Hostinger / Cloudflare never
 * receive a multi‑MB HTML blob. Full print uses /admin/reports/[id]/print.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdminSession();
  if (error) return error;
  const { id } = await context.params;

  // Prefer the progressive print page for anything beyond a tiny sample.
  const wantsSample = req.nextUrl.searchParams.get("sample") === "1";
  if (!wantsSample) {
    const base = req.nextUrl.origin;
    return NextResponse.redirect(`${base}/admin/reports/${id}/print`);
  }

  const report = await getOfficeReportDetailForPdf(id, { maxLines: 50 });
  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });

  const autoPrint = req.nextUrl.searchParams.get("print") === "1";
  const html = buildOfficeReportPdfHtml(report, {
    autoPrint,
    sampleNote:
      report.truncated
        ? `Sample preview: showing first ${report.lines.length} of ${report.lineCount} unique items. Open Print / PDF for the full report (loaded in safe batches).`
        : undefined,
  });
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
