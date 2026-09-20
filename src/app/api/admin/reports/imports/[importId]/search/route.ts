import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { searchOfficeItemCodes } from "@/services/office-report.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ importId: string }> }
) {
  try {
    const { error } = await requireAdminSession();
    if (error) return error;
    const { importId } = await context.params;
    const q = req.nextUrl.searchParams.get("q") ?? "";
    const offset = Number(req.nextUrl.searchParams.get("offset") ?? "0");
    const results = await searchOfficeItemCodes(
      importId,
      q,
      40,
      Number.isFinite(offset) ? offset : 0
    );
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Search failed", results: [] },
      { status: 400 }
    );
  }
}
