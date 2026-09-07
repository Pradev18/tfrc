import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/admin-auth";
import { generateShopCategories, getCatalogueById } from "@/services/catalogue-admin.service";
import prisma from "@/lib/db";
import { slugify } from "@/lib/slugify";
import { touchSiteRevision } from "@/lib/site-revision.server";
import { persistRuntimeCatalogueDataSafely } from "@/lib/persist-runtime-data.server";
import { syncEnvironmentShopCategories } from "@/lib/shop-category-sync";
import { getShopCategoryDefsForEnvironment } from "@/services/shop-category.service";
import { OTHER_SHOP_CATEGORY } from "@/lib/shop-categories";

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function revalidateCatalogueStore(slug: string, catalogueId: string) {
  revalidatePath("/", "layout");
  revalidatePath(`/${slug}`);
  revalidatePath(`/${slug}`, "layout");
  revalidatePath(`/admin/catalogues/${catalogueId}`);
}

async function resyncShopBuckets(environmentId: string, slug: string) {
  const defs = await getShopCategoryDefsForEnvironment(environmentId, slug);
  if (defs.length === 0) return;
  await syncEnvironmentShopCategories(environmentId, defs);
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const { error } = await requireAdminSession();
  if (error) return error;

  const { id } = await context.params;
  const catalogue = await getCatalogueById(id);
  if (!catalogue) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const groupedCounts = await prisma.product.groupBy({
    by: ["shopCategorySlug"],
    where: { environmentId: id, deletedAt: null },
    _count: { _all: true },
  });
  const countBySlug = new Map(
    groupedCounts.map((group) => [group.shopCategorySlug, group._count._all])
  );
  const unassignedCount =
    (countBySlug.get(null) ?? 0) +
    (countBySlug.get(OTHER_SHOP_CATEGORY.slug) ?? 0);
  const categories = catalogue.shopCategories
    .filter((category) => category.isActive)
    .map((category) => ({
      ...category,
      keywords: JSON.parse(category.keywords || "[]"),
      productCount: countBySlug.get(category.slug) ?? 0,
    }));
  if (
    unassignedCount > 0 &&
    !categories.some((category) => category.slug === OTHER_SHOP_CATEGORY.slug)
  ) {
    categories.push({
      id: OTHER_SHOP_CATEGORY.slug,
      environmentId: id,
      slug: OTHER_SHOP_CATEGORY.slug,
      name: OTHER_SHOP_CATEGORY.name,
      keywords: [],
      imageUrl: null,
      sortOrder: Number.MAX_SAFE_INTEGER,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      productCount: unassignedCount,
    });
  }

  return NextResponse.json(
    { categories },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { error } = await requireAdminSession();
  if (error) return error;

  const { id } = await context.params;
  const catalogue = await getCatalogueById(id);
  if (!catalogue) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  if (body.action === "regenerate") {
    const count = await generateShopCategories(id, catalogue.slug);
    await touchSiteRevision();
    await persistRuntimeCatalogueDataSafely();
    await revalidateCatalogueStore(catalogue.slug, id);
    return NextResponse.json(
      { regenerated: count },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  if (body.action === "create") {
    const cat = await prisma.shopCategory.create({
      data: {
        environmentId: id,
        slug: slugify(body.name),
        name: body.name,
        keywords: JSON.stringify(body.keywords ?? []),
        sortOrder: body.sortOrder ?? 99,
      },
    });
    await resyncShopBuckets(id, catalogue.slug);
    await touchSiteRevision();
    await persistRuntimeCatalogueDataSafely();
    await revalidateCatalogueStore(catalogue.slug, id);
    return NextResponse.json(
      { category: cat },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { error } = await requireAdminSession();
  if (error) return error;

  const body = await req.json();
  if (!body.categoryId) {
    return NextResponse.json({ error: "categoryId required" }, { status: 400 });
  }

  const { id } = await context.params;
  const catalogue = await getCatalogueById(id);
  if (!catalogue) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await prisma.shopCategory.updateMany({
    where: { id: body.categoryId, environmentId: id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.keywords !== undefined ? { keywords: JSON.stringify(body.keywords) } : {}),
      ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  const category = await prisma.shopCategory.findUnique({ where: { id: body.categoryId } });
  await resyncShopBuckets(id, catalogue.slug);
  await touchSiteRevision();
  await persistRuntimeCatalogueDataSafely();
  await revalidateCatalogueStore(catalogue.slug, id);
  return NextResponse.json(
    { category },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const { error } = await requireAdminSession();
  if (error) return error;

  const body = await req.json();
  if (!body.categoryId) {
    return NextResponse.json({ error: "categoryId required" }, { status: 400 });
  }

  const { id } = await context.params;
  const catalogue = await getCatalogueById(id);
  if (!catalogue) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await prisma.shopCategory.deleteMany({
    where: { id: body.categoryId, environmentId: id },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }
  await resyncShopBuckets(id, catalogue.slug);
  await touchSiteRevision();
  await persistRuntimeCatalogueDataSafely();
  await revalidateCatalogueStore(catalogue.slug, id);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
