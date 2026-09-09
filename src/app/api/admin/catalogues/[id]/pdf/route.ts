import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getCataloguePdfPayload } from "@/services/catalogue-pdf.service";
import { buildCataloguePdfHtml } from "@/lib/catalogue-pdf-html";
import { getSiteUrl } from "@/lib/site-config";
import { embedCatalogueImages, pdfImageOrPlaceholder } from "@/lib/catalogue-pdf-images";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

function absolutizeMediaUrl(url: string | null, origin: string): string | null {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `${origin}${url}`;
  return `${origin}/${url}`;
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { error } = await requireAdminSession();
  if (error) return error;

  const { id } = await context.params;
  const payload = await getCataloguePdfPayload(id);
  if (!payload) {
    return NextResponse.json({ error: "Catalogue not found" }, { status: 404 });
  }

  const origin = (req.nextUrl.origin || getSiteUrl()).replace(/\/$/, "");
  const logoAbsolute = absolutizeMediaUrl(payload.catalogue.logoUrl, origin);
  const productUrls = payload.categories.flatMap((category) =>
    category.products.map((product) => absolutizeMediaUrl(product.imageUrl, origin))
  );
  const embedded = await embedCatalogueImages([logoAbsolute, ...productUrls]);

  const withAbsoluteMedia = {
    ...payload,
    catalogue: {
      ...payload.catalogue,
      logoUrl: logoAbsolute
        ? embedded.get(logoAbsolute) ?? null
        : null,
    },
    categories: payload.categories.map((category) => ({
      ...category,
      products: category.products.map((product) => {
        const absolute = absolutizeMediaUrl(product.imageUrl, origin);
        return {
          ...product,
          imageUrl: pdfImageOrPlaceholder(absolute, embedded, product.name),
        };
      }),
    })),
  };

  const autoPrint = req.nextUrl.searchParams.get("print") === "1";
  const html = buildCataloguePdfHtml(withAbsoluteMedia, { autoPrint });
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
