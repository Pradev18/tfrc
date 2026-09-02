import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { generateShopCategories, getCatalogueById } from "@/services/catalogue-admin.service";
import prisma from "@/lib/db";
import { slugify } from "@/lib/slugify";
import { touchSiteRevision } from "@/lib/site-revision.server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const { error } = await requireAdminSession();
  if (error) return error;

  const { id } = await context.params;
  const catalogue = await getCatalogueById(id);
  if (!catalogue) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    categories: catalogue.shopCategories.map((c) => ({
      ...c,
      keywords: JSON.parse(c.keywords || "[]"),
    })),
  });
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
    return NextResponse.json({ regenerated: count });
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
    await touchSiteRevision();
    return NextResponse.json({ category: cat }, { status: 201 });
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
  await touchSiteRevision();
  return NextResponse.json({ category });
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const { error } = await requireAdminSession();
  if (error) return error;

  const body = await req.json();
  if (!body.categoryId) {
    return NextResponse.json({ error: "categoryId required" }, { status: 400 });
  }

  const { id } = await context.params;
  const result = await prisma.shopCategory.deleteMany({
    where: { id: body.categoryId, environmentId: id },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }
  await touchSiteRevision();
  return NextResponse.json({ ok: true });
}
