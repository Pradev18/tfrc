import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { listOfficeReportDuplicateInventory } from "@/services/office-report.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  context: { params: Promise<{ importId: string }> }
) {
  const { error } = await requireAdminSession();
  if (error) return error;
  const { importId } = await context.params;
  const data = await listOfficeReportDuplicateInventory(importId);
  if (!data) return NextResponse.json({ error: "Import not found" }, { status: 404 });
  return NextResponse.json(data);
}
