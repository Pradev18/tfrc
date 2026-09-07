import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { buildMetaCatalogueTemplateBuffer } from "@/lib/import/meta-catalogue-template";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const { error } = await requireAdminSession();
  if (error) return error;

  const buffer = buildMetaCatalogueTemplateBuffer();
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="TFRC-catalogue-template.xlsx"; filename*=UTF-8\'\'TFRC-catalogue-template.xlsx',
      "Cache-Control": "no-store",
    },
  });
}
