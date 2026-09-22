import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { ingestOfficeReportSourceBatch } from "@/services/office-report.service";
import {
  HeavyJobBusyError,
  heavyJobBusyResponse,
  withHeavyJob,
} from "@/lib/admin-heavy-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

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
    const result = await withHeavyJob("report-ingest", () =>
      ingestOfficeReportSourceBatch(importId)
    );
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof HeavyJobBusyError) {
      const busy = heavyJobBusyResponse(e);
      return NextResponse.json(busy.body, {
        status: busy.status,
        headers: { "Retry-After": "10" },
      });
    }
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Failed to finish workbook import",
      },
      { status: 400 }
    );
  }
}
