import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import {
  addOfficeReportLine,
  getOfficeReportDetail,
} from "@/services/office-report.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdminSession();
  if (error) return error;
  const { id } = await context.params;
  const body = (await req.json()) as { itemCode?: string };
  try {
    await addOfficeReportLine(id, body.itemCode ?? "");
    const report = await getOfficeReportDetail(id);
    return NextResponse.json({ report });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to add item" },
      { status: 400 }
    );
  }
}
