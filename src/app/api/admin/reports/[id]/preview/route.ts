import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getOfficeReportDetail } from "@/services/office-report.service";
import { buildOfficeReportPdfHtml } from "@/lib/report/office-report-pdf-html";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdminSession();
  if (error) return error;
  const { id } = await context.params;
  const report = await getOfficeReportDetail(id);
  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });

  const autoPrint = req.nextUrl.searchParams.get("print") === "1";
  const html = buildOfficeReportPdfHtml(report, { autoPrint });
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
