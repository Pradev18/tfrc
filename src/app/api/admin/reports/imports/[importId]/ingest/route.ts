import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { ingestOfficeReportSourceBatch } from "@/services/office-report.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ importId: string }> }
) {
  try {
    const { error } = await requireAdminSession();
    if (error) return error;
    const { importId } = await context.params;
    if (!importId?.trim()) {
      return NextResponse.json({ error: "Missing import id" }, { status: 400 });
    }
    const result = await ingestOfficeReportSourceBatch(importId);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Failed to finish workbook import",
      },
      { status: 400 }
    );
  }
}
