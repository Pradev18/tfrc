import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import prisma from "@/lib/db";
import {
  addOfficeReportLine,
  getOfficeReportDetail,
} from "@/services/office-report.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireAdminSession();
    if (error) return error;
    const { id } = await context.params;
    const page = Number(req.nextUrl.searchParams.get("page") || "1");
    const pageSize = Number(req.nextUrl.searchParams.get("pageSize") || "100");
    const report = await getOfficeReportDetail(id, {
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 100,
    });
    if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
    return NextResponse.json({ report });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load report rows" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireAdminSession();
    if (error) return error;
    const { id } = await context.params;
    let body: { itemCode?: string; page?: number; pageSize?: number } = {};
    try {
      body = (await req.json()) as { itemCode?: string; page?: number; pageSize?: number };
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const created = await addOfficeReportLine(id, body.itemCode ?? "");
    const pageSize = Number.isFinite(body.pageSize)
      ? Math.min(Math.max(body.pageSize ?? 100, 1), 500)
      : 100;
    const lineCount = await prisma.officeReportLine.count({ where: { reportId: id } });
    const lastPage = Math.max(1, Math.ceil(lineCount / pageSize));
    const report = await getOfficeReportDetail(id, {
      page: lastPage,
      pageSize,
    });
    return NextResponse.json({ report, addedLineId: created.id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to add item" },
      { status: 400 }
    );
  }
}
