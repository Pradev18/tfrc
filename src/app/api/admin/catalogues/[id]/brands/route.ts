import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/admin-auth";
import { getCatalogueById } from "@/services/catalogue-admin.service";
import prisma from "@/lib/db";
import { touchSiteRevision } from "@/lib/site-revision.server";
import { refreshCatalogCacheFromDatabase } from "@/lib/catalog-cache-refresh.server";
import { patchBrandLogoInCatalogCache } from "@/lib/catalog-cache";
import { requireCatalogueUnlocked } from "@/lib/catalogue-lock";
import { normalizeBrandLogoInput } from "@/lib/brand-logo-url";
import { saveBrandLogoImage } from "@/lib/upload";

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function assertBrandInCatalogue(brandId: string, catalogueId: string) {
  return prisma.brand.findFirst({
    where: {
      id: brandId,
      products: {
        some: {
          environmentId: catalogueId,
          deletedAt: null,
        },
      },
    },
    select: { id: true, name: true, slug: true, logoUrl: true },
  });
}

async function publishBrandLogoChange(
  catalogueSlug: string,
  catalogueId: string,
  brand: { id: string; name: string; slug: string; logoUrl: string | null }
) {
  // Instant store reflection — patch logo in file cache, then refresh in background.
  patchBrandLogoInCatalogCache({
    brandId: brand.id,
    brandSlug: brand.slug,
    logoUrl: brand.logoUrl,
  });
  await touchSiteRevision();
  revalidatePath(`/${catalogueSlug}`);
  revalidatePath(`/${catalogueSlug}`, "layout");
  revalidatePath(`/admin/catalogues/${catalogueId}`);
  revalidatePath(`/admin/catalogues/${catalogueId}/manage`);
  void refreshCatalogCacheFromDatabase().catch((error) => {
    console.error("[brands] background catalog cache refresh failed:", error);
  });
  return brand;
}

/**
 * Catalogue brand strip admin API — isolated from product/PDF/import routes.
 * Logos: Excel brand_image, pasted URL, or device upload → R2 brand_logo/.
 */
export async function GET(_req: NextRequest, context: RouteContext) {
  const { error } = await requireAdminSession();
  if (error) return error;

  const { id } = await context.params;
  const catalogue = await getCatalogueById(id);
  if (!catalogue) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const brands = await prisma.brand.findMany({
    where: {
      isActive: true,
      products: {
        some: {
          environmentId: id,
          status: "ACTIVE",
          deletedAt: null,
        },
      },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      _count: {
        select: {
          products: {
            where: {
              environmentId: id,
              status: "ACTIVE",
              deletedAt: null,
            },
          },
        },
      },
    },
  });

  return NextResponse.json(
    {
      brands: brands.map((brand) => ({
        id: brand.id,
        name: brand.name,
        slug: brand.slug,
        logoUrl: brand.logoUrl,
        productCount: brand._count.products,
      })),
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { error } = await requireAdminSession();
  if (error) return error;

  const { id } = await context.params;
  const lockError = await requireCatalogueUnlocked(id);
  if (lockError) return lockError;

  const catalogue = await getCatalogueById(id);
  if (!catalogue) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { brandId?: string; logoUrl?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const brandId = body.brandId?.trim();
  if (!brandId) {
    return NextResponse.json({ error: "brandId is required" }, { status: 400 });
  }

  const linked = await assertBrandInCatalogue(brandId, id);
  if (!linked) {
    return NextResponse.json(
      { error: "Brand is not used in this catalogue" },
      { status: 404 }
    );
  }

  const raw = body.logoUrl == null ? "" : String(body.logoUrl).trim();
  const logoUrl = raw === "" ? null : normalizeBrandLogoInput(raw);
  if (raw && !logoUrl) {
    return NextResponse.json(
      {
        error:
          "Use a full https URL or an R2 path like brand_logo/levi.png",
      },
      { status: 400 }
    );
  }

  const updated = await prisma.brand.update({
    where: { id: brandId },
    data: { logoUrl },
    select: { id: true, name: true, slug: true, logoUrl: true },
  });

  await publishBrandLogoChange(catalogue.slug, id, updated);

  return NextResponse.json(
    { brand: updated },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

/** Device upload → Cloudflare R2 brand_logo/ → Brand.logoUrl */
export async function POST(req: NextRequest, context: RouteContext) {
  const { error } = await requireAdminSession();
  if (error) return error;

  const { id } = await context.params;
  const lockError = await requireCatalogueUnlocked(id);
  if (lockError) return lockError;

  const catalogue = await getCatalogueById(id);
  if (!catalogue) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const brandId = String(formData.get("brandId") || "").trim();
  const file = formData.get("file");
  if (!brandId) {
    return NextResponse.json({ error: "brandId is required" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose an image file" }, { status: 400 });
  }

  const linked = await assertBrandInCatalogue(brandId, id);
  if (!linked) {
    return NextResponse.json(
      { error: "Brand is not used in this catalogue" },
      { status: 404 }
    );
  }

  try {
    const url = await saveBrandLogoImage(file, linked.slug);
    const updated = await prisma.brand.update({
      where: { id: brandId },
      data: { logoUrl: url },
      select: { id: true, name: true, slug: true, logoUrl: true },
    });
    await publishBrandLogoChange(catalogue.slug, id, updated);
    return NextResponse.json(
      { brand: updated, url },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 400 }
    );
  }
}
