import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getCatalogueById } from "@/services/catalogue-admin.service";
import prisma from "@/lib/db";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { error } = await requireAdminSession();
  if (error) return error;

  const { id } = await context.params;
  const catalogue = await getCatalogueById(id);
  if (!catalogue) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(sp.get("limit") ?? "20", 10) || 20));
  const skip = (page - 1) * limit;

  const where = {
    environmentId: id,
    deletedAt: null,
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { productId: { contains: q } },
            { sku: { contains: q } },
          ],
        }
      : {}),
  };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
      include: {
        prices: true,
        inventory: true,
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
        brand: { select: { name: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return NextResponse.json(
    { products, total, page, limit },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
