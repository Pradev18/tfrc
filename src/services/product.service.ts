import prisma from "@/lib/db";
import { ProductStatus, Prisma } from "@prisma/client";
import { getEffectivePrice } from "@/lib/pricing";
import { getEnvironmentIdBySlug } from "@/services/environment.service";
import { getDepartmentForSlug } from "@/lib/environments";
import { getShopCategoryDef, getShopCategoryDefs, OTHER_SHOP_CATEGORY } from "@/lib/shop-categories";
import { shopCategoryOrFilter, otherShopCategoryFilter } from "@/services/shop-category.service";

export interface ProductFilters {
  search?: string;
  categorySlug?: string;
  shopCategorySlug?: string;
  brandSlug?: string;
  onSale?: boolean;
  inStock?: boolean;
  department?: string;
  environmentId?: string;
  environmentSlug?: string;
  tag?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: "featured" | "newest" | "price_asc" | "price_desc" | "discount" | "name";
  page?: number;
  limit?: number;
  listMode?: boolean;
}

export type ProductWithRelations = Prisma.ProductGetPayload<{
  include: typeof productInclude;
}>;

const productInclude = {
  images: { orderBy: { sortOrder: "asc" as const } },
  videos: { orderBy: { sortOrder: "asc" as const } },
  prices: true,
  brand: true,
  category: true,
  subcategory: true,
  inventory: true,
  environment: true,
  tags: { include: { tag: true } },
};

/** Lightweight include for store grids — scales to large catalogues */
export const productListInclude = {
  images: { orderBy: { sortOrder: "asc" as const }, take: 2 },
  videos: { take: 1, select: { id: true } },
  prices: true,
  brand: { select: { id: true, name: true, slug: true } },
  inventory: { select: { isInStock: true } },
};

export type ProductListItem = Prisma.ProductGetPayload<{
  include: typeof productListInclude;
}>;

type ProductWithPrices = {
  prices: Array<{
    type: string;
    amount: number;
    currency: string;
    saleStart?: Date | null;
    saleEnd?: Date | null;
  }>;
};

export function mapProductPrices(product: ProductWithPrices) {
  const regular = product.prices.find((p) => p.type === "REGULAR");
  const sale = product.prices.find((p) => p.type === "SALE");
  const pricing = getEffectivePrice({
    regular: regular?.amount ?? 0,
    sale: sale?.amount,
    currency: regular?.currency ?? "QAR",
    saleStart: sale?.saleStart,
    saleEnd: sale?.saleEnd,
  });
  return { regular, sale, pricing };
}

export async function getProducts(filters: ProductFilters = {}) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 24;
  const skip = (page - 1) * limit;

  const where: Prisma.ProductWhereInput = {
    status: ProductStatus.ACTIVE,
    deletedAt: null,
  };

  let environmentId = filters.environmentId;
  if (!environmentId && filters.environmentSlug) {
    environmentId = (await getEnvironmentIdBySlug(filters.environmentSlug)) ?? undefined;
  }

  if (environmentId) {
    where.environmentId = environmentId;
  } else if (filters.department) {
    where.departmentSource = filters.department;
  } else if (filters.environmentSlug) {
    const dept = getDepartmentForSlug(filters.environmentSlug);
    if (dept) where.departmentSource = dept;
  }

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search } },
      { productId: { contains: filters.search } },
      { sku: { contains: filters.search } },
      { description: { contains: filters.search } },
      { brand: { name: { contains: filters.search } } },
      { category: { name: { contains: filters.search } } },
    ];
  }

  if (filters.categorySlug) {
    const cat = await prisma.category.findUnique({
      where: { slug: filters.categorySlug },
      include: { children: { include: { children: true } } },
    });
    if (cat) {
      const ids = collectCategoryIds(cat);
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [
            { categoryId: { in: ids } },
            { subcategoryId: { in: ids } },
          ],
        },
      ];
    }
  }

  if (filters.shopCategorySlug && filters.environmentSlug) {
    if (filters.shopCategorySlug === OTHER_SHOP_CATEGORY.slug) {
      const defs = getShopCategoryDefs(filters.environmentSlug);
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        { OR: otherShopCategoryFilter(defs) },
      ];
    } else {
      const shopCat = getShopCategoryDef(filters.environmentSlug, filters.shopCategorySlug);
      if (shopCat) {
        const orFilter = shopCategoryOrFilter(shopCat);
        if (orFilter.length > 0) {
          where.AND = [
            ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
            { OR: orFilter },
          ];
        }
      }
    }
  }

  if (filters.brandSlug) {
    where.brand = { slug: filters.brandSlug };
  }

  if (filters.department) {
    where.departmentSource = filters.department;
  }

  if (filters.inStock) {
    where.inventory = { isInStock: true };
  }

  if (filters.onSale) {
    where.prices = { some: { type: "SALE" } };
  }

  let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: "desc" };

  switch (filters.sort) {
    case "featured":
      orderBy = { isFeatured: "desc" };
      break;
    case "name":
      orderBy = { name: "asc" };
      break;
    case "newest":
      orderBy = { createdAt: "desc" };
      break;
    default:
      orderBy = { createdAt: "desc" };
  }

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: filters.listMode ? productListInclude : productInclude,
      orderBy,
      skip,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  let sorted = items;
  if (filters.sort === "price_asc" || filters.sort === "price_desc" || filters.sort === "discount") {
    sorted = [...items].sort((a, b) => {
      const pa = mapProductPrices(a).pricing.displayPrice;
      const pb = mapProductPrices(b).pricing.displayPrice;
      if (filters.sort === "discount") {
        const da = mapProductPrices(a).pricing.discountPercent ?? 0;
        const db = mapProductPrices(b).pricing.discountPercent ?? 0;
        return db - da;
      }
      return filters.sort === "price_asc" ? pa - pb : pb - pa;
    });
  }

  return {
    items: sorted,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

function collectCategoryIds(cat: {
  id: string;
  children?: Array<{ id: string; children?: Array<{ id: string }> }>;
}): string[] {
  const ids = [cat.id];
  for (const child of cat.children ?? []) {
    ids.push(child.id);
    for (const grand of child.children ?? []) {
      ids.push(grand.id);
    }
  }
  return ids;
}

export async function getProductBySlug(slug: string, environmentSlug?: string) {
  const environmentId = environmentSlug
    ? await getEnvironmentIdBySlug(environmentSlug)
    : null;

  return prisma.product.findFirst({
    where: {
      slug,
      status: ProductStatus.ACTIVE,
      deletedAt: null,
      ...(environmentId ? { environmentId } : {}),
    },
    include: productInclude,
  });
}

export async function getProductEnvironmentSlug(productId: string): Promise<string | null> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { environment: { select: { slug: true } } },
  });
  return product?.environment?.slug ?? null;
}

export async function getRelatedProducts(
  product: ProductWithRelations,
  limit = 4,
  environmentId?: string
) {
  return prisma.product.findMany({
    where: {
      status: ProductStatus.ACTIVE,
      deletedAt: null,
      id: { not: product.id },
      ...(environmentId || product.environmentId
        ? { environmentId: environmentId ?? product.environmentId ?? undefined }
        : {}),
      OR: [
        { categoryId: product.categoryId ?? undefined },
        { subcategoryId: product.subcategoryId ?? undefined },
        { brandId: product.brandId ?? undefined },
      ],
    },
    include: productInclude,
    take: limit,
  });
}

export async function getFeaturedProducts(limit = 8, environmentSlug?: string) {
  const environmentId = environmentSlug
    ? await getEnvironmentIdBySlug(environmentSlug)
    : null;

  const envFilter = environmentId ? { environmentId } : {};

  const featured = await prisma.product.findMany({
    where: { status: ProductStatus.ACTIVE, isFeatured: true, deletedAt: null, ...envFilter },
    include: productInclude,
    take: limit,
  });
  if (featured.length >= limit) return featured;
  const rest = await prisma.product.findMany({
    where: { status: ProductStatus.ACTIVE, deletedAt: null, ...envFilter },
    include: productInclude,
    take: limit - featured.length,
    orderBy: { createdAt: "desc" },
  });
  return [...featured, ...rest].slice(0, limit);
}

export async function getSaleProducts(limit = 8, environmentSlug?: string) {
  const environmentId = environmentSlug
    ? await getEnvironmentIdBySlug(environmentSlug)
    : null;

  const products = await prisma.product.findMany({
    where: {
      status: ProductStatus.ACTIVE,
      deletedAt: null,
      ...(environmentId ? { environmentId } : {}),
      prices: { some: { type: "SALE" } },
    },
    include: productInclude,
    take: limit * 4,
  });
  return products
    .filter((p) => mapProductPrices(p).pricing.isOnSale)
    .sort(
      (a, b) =>
        (mapProductPrices(b).pricing.discountPercent ?? 0) -
        (mapProductPrices(a).pricing.discountPercent ?? 0)
    )
    .slice(0, limit * 4);
}

/** All active products for an environment */
export async function getAllEnvironmentProducts(environmentSlug: string) {
  const environmentId = await getEnvironmentIdBySlug(environmentSlug);
  if (!environmentId) return [];

  return prisma.product.findMany({
    where: {
      status: ProductStatus.ACTIVE,
      deletedAt: null,
      environmentId,
    },
    include: productInclude,
    orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
  });
}

/** All active sale products for an environment (or platform-wide) */
export async function getAllSaleProducts(environmentSlug?: string) {
  const environmentId = environmentSlug
    ? await getEnvironmentIdBySlug(environmentSlug)
    : null;

  const products = await prisma.product.findMany({
    where: {
      status: ProductStatus.ACTIVE,
      deletedAt: null,
      ...(environmentId ? { environmentId } : {}),
      prices: { some: { type: "SALE" } },
    },
    include: productInclude,
  });

  return products
    .filter((p) => mapProductPrices(p).pricing.isOnSale)
    .sort(
      (a, b) =>
        (mapProductPrices(b).pricing.discountPercent ?? 0) -
        (mapProductPrices(a).pricing.discountPercent ?? 0)
    );
}

export async function getProductStats() {
  const [total, active, onSale, outOfStock, categories, brands] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { status: ProductStatus.ACTIVE } }),
    prisma.product.count({
      where: { status: ProductStatus.ACTIVE, prices: { some: { type: "SALE" } } },
    }),
    prisma.product.count({
      where: { status: ProductStatus.ACTIVE, inventory: { isInStock: false } },
    }),
    prisma.category.count({ where: { isActive: true } }),
    prisma.brand.count({ where: { isActive: true } }),
  ]);
  return { total, active, onSale, outOfStock, categories, brands };
}
