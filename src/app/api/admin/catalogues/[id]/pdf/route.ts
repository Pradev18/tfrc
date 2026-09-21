import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getCataloguePdfPayload } from "@/services/catalogue-pdf.service";
import { assembleCataloguePdfHtml } from "@/lib/catalogue-pdf-build";
import { getSiteUrl } from "@/lib/site-config";
import { requireCatalogueUnlocked } from "@/lib/catalogue-lock";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: NextRequest, context: RouteContext) {
  const { error } = await requireAdminSession();
  if (error) return error;

  const { id } = await context.params;
  const lockError = await requireCatalogueUnlocked(id);
  if (lockError) return lockError;

  const payload = await getCataloguePdfPayload(id);
  if (!payload) {
    return NextResponse.json({ error: "Catalogue not found" }, { status: 404 });
  }

  const origin = (req.nextUrl.origin || getSiteUrl()).replace(/\/$/, "");
  const autoPrint = req.nextUrl.searchParams.get("print") === "1";
  const { html } = await assembleCataloguePdfHtml(payload, { origin, autoPrint });
  const filename = `${payload.catalogue.slug || "catalogue"}-brochure.pdf.html`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
