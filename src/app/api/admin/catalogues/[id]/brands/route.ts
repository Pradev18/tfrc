import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/admin-auth";
import { getCatalogueById } from "@/services/catalogue-admin.service";
import prisma from "@/lib/db";
import { touchSiteRevision } from "@/lib/site-revision.server";
import { persistRuntimeCatalogueDataSafely } from "@/lib/persist-runtime-data.server";
import { requireCatalogueUnlocked } from "@/lib/catalogue-lock";
import { normalizeBrandLogoInput } from "@/lib/brand-logo-url";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Catalogue brand strip admin API — isolated from product/PDF/import routes.
 * Brands are listed for this catalogue only; logoUrl comes from Excel brand_image
 * or an optional admin URL patch (never from product photos).
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

  return NextResponse.json({
    brands: brands.map((brand) => ({
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      logoUrl: brand.logoUrl,
      productCount: brand._count.products,
    })),
  });
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

  const linked = await prisma.brand.findFirst({
    where: {
      id: brandId,
      products: {
        some: {
          environmentId: id,
          deletedAt: null,
        },
      },
    },
    select: { id: true },
  });
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
          "Use a full https URL or an R2 path like BRAND_LOGO/levi.png",
      },
      { status: 400 }
    );
  }

  const updated = await prisma.brand.update({
    where: { id: brandId },
    data: { logoUrl },
    select: { id: true, name: true, slug: true, logoUrl: true },
  });

  await touchSiteRevision();
  void persistRuntimeCatalogueDataSafely();
  revalidatePath(`/${catalogue.slug}`);
  revalidatePath(`/${catalogue.slug}`, "layout");
  revalidatePath(`/admin/catalogues/${id}`);

  return NextResponse.json({ brand: updated });
}
