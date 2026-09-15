import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { seedOfficeReportLinesBatch } from "@/services/office-report.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdminSession();
  if (error) return error;
  const { id } = await context.params;
  try {
    const result = await seedOfficeReportLinesBatch(id);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Seed batch failed" },
      { status: 400 }
    );
  }
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdminSession();
  if (error) return error;
  const { id } = await context.params;
  const { getOfficeReportSeedStatus } = await import("@/services/office-report.service");
  const status = await getOfficeReportSeedStatus(id);
  if (!status) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  return NextResponse.json(status);
}
