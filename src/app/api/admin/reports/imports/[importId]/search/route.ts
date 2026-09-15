import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { searchOfficeItemCodes } from "@/services/office-report.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ importId: string }> }
) {
  const { error } = await requireAdminSession();
  if (error) return error;
  const { importId } = await context.params;
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const results = await searchOfficeItemCodes(importId, q);
  return NextResponse.json({ results });
}
