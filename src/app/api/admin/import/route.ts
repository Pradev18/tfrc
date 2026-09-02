import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";

/**
 * Legacy global import is disabled.
 * Use catalogue-scoped replace: POST /api/admin/catalogues/[id]/import
 */
export async function POST(_req: NextRequest) {
  const { error } = await requireAdminSession();
  if (error) return error;

  return NextResponse.json(
    {
      error:
        "Global import is disabled. Open a catalogue and use Import Excel / Replace catalogue so the correct shop is updated.",
    },
    { status: 410, headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET() {
  return NextResponse.json(
    {
      error: "Use /admin/imports or a catalogue Import Excel tab to replace products.",
    },
    { status: 410, headers: { "Cache-Control": "no-store" } }
  );
}
