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
    page?: number;
    pageSize?: number;
  };
  try {
    await updateOfficeReportLine(id, lineId, body);
    const report = await getOfficeReportDetail(id, {
      page: body.page ?? 1,
      pageSize: body.pageSize ?? 100,
    });
    return NextResponse.json({ report });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update line" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; lineId: string }> }
) {
  const { error } = await requireAdminSession();
  if (error) return error;
  const { id, lineId } = await context.params;
  const page = Number(req.nextUrl.searchParams.get("page") || "1");
  const pageSize = Number(req.nextUrl.searchParams.get("pageSize") || "100");
  try {
    await deleteOfficeReportLine(id, lineId);
    const report = await getOfficeReportDetail(id, {
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 100,
    });
    return NextResponse.json({ report });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to delete line" },
      { status: 400 }
    );
  }
}
