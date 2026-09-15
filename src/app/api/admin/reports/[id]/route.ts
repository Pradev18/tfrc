import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import {
  deleteOfficeReport,
  getOfficeReportDetail,
  updateOfficeReportMeta,
} from "@/services/office-report.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdminSession();
  if (error) return error;
  const { id } = await context.params;
  const report = await getOfficeReportDetail(id);
  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  return NextResponse.json({ report });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdminSession();
  if (error) return error;
  const { id } = await context.params;
  const body = (await req.json()) as Record<string, string>;
  try {
    await updateOfficeReportMeta(id, body);
    const report = await getOfficeReportDetail(id);
    return NextResponse.json({ report });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Update failed" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdminSession();
  if (error) return error;
  const { id } = await context.params;
  try {
    await deleteOfficeReport(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Delete failed" },
      { status: 400 }
    );
  }
}
