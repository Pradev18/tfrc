import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import {
  deleteOfficeReportLine,
  getOfficeReportDetail,
  updateOfficeReportLine,
} from "@/services/office-report.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; lineId: string }> }
) {
  const { error } = await requireAdminSession();
  if (error) return error;
  const { id, lineId } = await context.params;
  const body = (await req.json()) as {
    itemCode?: string;
    wholesalePriceApproval?: string;
  };
  try {
    await updateOfficeReportLine(id, lineId, body);
    const report = await getOfficeReportDetail(id);
    return NextResponse.json({ report });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update line" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string; lineId: string }> }
) {
  const { error } = await requireAdminSession();
  if (error) return error;
  const { id, lineId } = await context.params;
  try {
    await deleteOfficeReportLine(id, lineId);
    const report = await getOfficeReportDetail(id);
    return NextResponse.json({ report });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to delete line" },
      { status: 400 }
    );
  }
}
