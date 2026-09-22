import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import {
  listCustomerInquiries,
  permanentlyDeleteCustomerInquiries,
} from "@/services/inquiry.service";

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

export async function DELETE(req: NextRequest) {
  const { error } = await requireAdminSession();
  if (error) return error;

  const body = (await req.json().catch(() => null)) as
    | { all?: boolean; ids?: unknown }
    | null;

  if (body?.all === true) {
    const deleted = await permanentlyDeleteCustomerInquiries({ all: true });
    return NextResponse.json({ ok: true, deleted });
  }

  const ids = Array.isArray(body?.ids)
    ? body.ids.filter(
        (id): id is string => typeof id === "string" && id.trim().length > 0
      )
    : [];
  if (ids.length === 0 || ids.length > 1000) {
    return NextResponse.json(
      { error: "Select between 1 and 1000 activity records to delete." },
      { status: 400 }
    );
  }

  const deleted = await permanentlyDeleteCustomerInquiries({ ids });
  return NextResponse.json({ ok: true, deleted });
}
