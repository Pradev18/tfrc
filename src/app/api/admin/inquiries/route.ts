import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { listCustomerInquiries } from "@/services/inquiry.service";

function parseDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export async function GET(req: NextRequest) {
  const { error } = await requireAdminSession();
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const result = await listCustomerInquiries({
    eventType: searchParams.get("eventType") ?? undefined,
    environmentSlug: searchParams.get("environmentSlug") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    from: parseDate(searchParams.get("from")),
    to: parseDate(searchParams.get("to")),
    page: Number(searchParams.get("page") ?? "1"),
    pageSize: Number(searchParams.get("pageSize") ?? "25"),
  });

  return NextResponse.json(result);
}
