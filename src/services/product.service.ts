import prisma from "@/lib/db";
import { ProductStatus, Prisma } from "@prisma/client";
import { mapProductPrices } from "@/lib/pricing";
import { getEnvironmentIdBySlug } from "@/services/environment.service";
import { getDepartmentForSlug } from "@/lib/environments";
import {
  getEffectiveShopCategoryDefs,
  OTHER_SHOP_CATEGORY,
} from "@/lib/shop-categories";
import { getCachedEnvironment, getCachedProducts } from "@/lib/catalog-cache";
import { compareVariantLabels } from "@/lib/product-variants";
import { cache } from "react";

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
  /** Show every imported row instead of grouping size variants into one card. */
  includeVariants?: boolean;
}

async function getDatabaseSortedProductIds(
  filters: ProductFilters,
  environmentId: string | undefined,
  skip: number,
  limit: number
): Promise<string[] | null> {
  if (
    !filters.listMode ||
    !["price_asc", "price_desc", "discount"].includes(filters.sort ?? "") ||
    filters.categorySlug ||
    filters.tag ||
    filters.minPrice != null ||
    filters.maxPrice != null
  ) {
    return null;
  }

  const clauses: Prisma.Sql[] = [
    Prisma.sql`p.status = ${ProductStatus.ACTIVE}`,
    Prisma.sql`p.deletedAt IS NULL`,
  ];
  if (!filters.includeVariants) {
    clauses.push(Prisma.sql`p.isVariantPrimary = ${true}`);
  }

  if (environmentId) clauses.push(Prisma.sql`p.environmentId = ${environmentId}`);
  if (filters.department) clauses.push(Prisma.sql`p.departmentSource = ${filters.department}`);
  if (filters.shopCategorySlug === OTHER_SHOP_CATEGORY.slug) {
    clauses.push(
      Prisma.sql`(p.shopCategorySlug = ${OTHER_SHOP_CATEGORY.slug} OR p.shopCategorySlug IS NULL)`
    );
  } else if (filters.shopCategorySlug) {
    clauses.push(Prisma.sql`p.shopCategorySlug = ${filters.shopCategorySlug}`);
  }
  if (filters.brandSlug) {
    clauses.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM Brand b WHERE b.id = p.brandId AND b.slug = ${filters.brandSlug}
      )`
    );
  }
  if (filters.inStock) {
    clauses.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM Inventory i WHERE i.productId = p.id AND i.isInStock = ${true}
      )`
    );
  }
  if (filters.onSale) {
    clauses.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM Price sale_filter
        WHERE sale_filter.productId = p.id AND sale_filter.type = 'SALE'
      )`
    );
  }
  if (filters.search) {
    const query = `%${filters.search}%`;
    clauses.push(
      Prisma.sql`(
        p.name LIKE ${query}
        OR p.productId LIKE ${query}
        OR p.sku LIKE ${query}
        OR p.description LIKE ${query}
        OR EXISTS (SELECT 1 FROM Brand sb WHERE sb.id = p.brandId AND sb.name LIKE ${query})
        OR EXISTS (SELECT 1 FROM Category sc WHERE sc.id IN (p.categoryId, p.subcategoryId) AND sc.name LIKE ${query})
      )`
    );
  }

  const direction =
    filters.sort === "price_asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const sortValue =
    filters.sort === "discount"
      ? Prisma.sql`CASE
          WHEN priced.regularPrice > 0
            AND priced.salePrice > 0
            AND priced.salePrice < priced.regularPrice
          THEN (priced.regularPrice - priced.salePrice) / priced.regularPrice
          ELSE 0
        END`
      : Prisma.sql`COALESCE(
          CASE
            WHEN priced.salePrice > 0
              AND priced.salePrice < priced.regularPrice
            THEN priced.salePrice
            ELSE priced.regularPrice
          END,
          0
        )`;

  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT priced.id
    FROM (
      SELECT
        p.id,
        (
          SELECT regular.amount
          FROM Price regular
          WHERE regular.productId = p.id AND regular.type = 'REGULAR'
          ORDER BY regular.createdAt DESC
          LIMIT 1
        ) AS regularPrice,
        (
          SELECT sale.amount
          FROM Price sale
          WHERE sale.productId = p.id AND sale.type = 'SALE'
          ORDER BY sale.createdAt DESC
          LIMIT 1
        ) AS salePrice
      FROM Product p
      WHERE ${Prisma.join(clauses, " AND ")}
    ) priced
    ORDER BY ${sortValue} ${direction}, priced.id ASC
    LIMIT ${limit} OFFSET ${skip}
  `);

  return rows.map((row) => row.id);
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

export { mapProductPrices } from "@/lib/pricing";

export async function getProducts(filters: ProductFilters = {}) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 24;

  try {
    return await getProductsFromPrisma(filters);
  } catch (error) {
    console.error("[products] prisma failed, using catalog cache:", error);
    if (!filters.environmentSlug) throw error;

    const cachedEnvironment = getCachedEnvironment(filters.environmentSlug);
    const categoryDefs = getEffectiveShopCategoryDefs(
      filters.environmentSlug,
      cachedEnvironment?.products.map((product) => product.name) ?? []
    );
    const selectedCategory = categoryDefs.find(
      (category) => category.slug === filters.shopCategorySlug
    );
    if (
      filters.shopCategorySlug &&
      filters.shopCategorySlug !== OTHER_SHOP_CATEGORY.slug &&
      !selectedCategory
    ) {
      return { items: [], total: 0, page, limit, totalPages: 0 };
    }
    const cached = getCachedProducts(filters.environmentSlug, {
      page,
      limit,
      q: filters.search,
      brandSlug: filters.brandSlug,
      onSale: filters.onSale,
      inStock: filters.inStock,
      shopSlug: filters.shopCategorySlug,
      shopDefs: categoryDefs,
      includeVariants: filters.includeVariants,
    });
    if (!cached) throw error;
    return {
      ...cached,
      items: cached.items as unknown as ProductListItem[],
    };
  }
}

async function getProductsFromPrisma(filters: ProductFilters = {}) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 24;
  const skip = (page - 1) * limit;

  const where: Prisma.ProductWhereInput = {
    status: ProductStatus.ACTIVE,
    deletedAt: null,
    ...(!filters.includeVariants ? { isVariantPrimary: true } : {}),
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

  if (filters.shopCategorySlug) {
    // Indexed exclusive bucket — set by syncEnvironmentShopCategories / import
    if (filters.shopCategorySlug === OTHER_SHOP_CATEGORY.slug) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [
            { shopCategorySlug: OTHER_SHOP_CATEGORY.slug },
            { shopCategorySlug: null },
          ],
        },
      ];
    } else {
      where.shopCategorySlug = filters.shopCategorySlug;
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

  const databaseSortedIds = await getDatabaseSortedProductIds(
    filters,
    environmentId,
    skip,
    limit
  );
  const [queriedItems, total] = await Promise.all([
    prisma.product.findMany({
      where: databaseSortedIds ? { id: { in: databaseSortedIds } } : where,
      include: filters.listMode ? productListInclude : productInclude,
      ...(databaseSortedIds ? {} : { orderBy, skip, take: limit }),
    }),
    prisma.product.count({ where }),
  ]);
  const items = databaseSortedIds
    ? databaseSortedIds
        .map((id) => queriedItems.find((item) => item.id === id))
        .filter((item): item is (typeof queriedItems)[number] => Boolean(item))
    : queriedItems;

  let sorted = items;
  if (
    databaseSortedIds === null &&
    (filters.sort === "price_asc" ||
      filters.sort === "price_desc" ||
      filters.sort === "discount")
  ) {
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

  const groupKeys = sorted
    .map((item) => item.variantGroupKey)
    .filter((key): key is string => Boolean(key));
  const siblingVariants =
    groupKeys.length > 0
      ? await prisma.product.findMany({
          where: {
            environmentId,
            status: ProductStatus.ACTIVE,
            deletedAt: null,
            variantGroupKey: { in: [...new Set(groupKeys)] },
          },
          include: productListInclude,
        })
      : [];
  const variantsByGroup = new Map<string, ProductListItem[]>();
  for (const variant of siblingVariants) {
    if (!variant.variantGroupKey) continue;
    const variants = variantsByGroup.get(variant.variantGroupKey) ?? [];
    variants.push(variant);
    variantsByGroup.set(variant.variantGroupKey, variants);
  }
  for (const variants of variantsByGroup.values()) {
    variants.sort((a, b) => compareVariantLabels(a.variantLabel, b.variantLabel));
  }

  return {
    items: sorted.map((item) => ({
      ...item,
      sizeVariants: item.variantGroupKey
        ? variantsByGroup.get(item.variantGroupKey) ?? []
        : [],
    })),
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

export const getProductBySlug = cache(async function getProductBySlug(
  slug: string,
  environmentSlug?: string
) {
  try {
    const environmentId = environmentSlug
      ? await getEnvironmentIdBySlug(environmentSlug)
      : null;

    const product = await prisma.product.findFirst({
      where: {
        slug,
        status: ProductStatus.ACTIVE,
        deletedAt: null,
        ...(environmentId ? { environmentId } : {}),
      },
      include: productInclude,
    });
    if (product) return product;
  } catch (error) {
    console.error("[products] getProductBySlug prisma failed:", error);
  }

  if (!environmentSlug) return null;
  const cached = getCachedEnvironment(environmentSlug);
  const hit = cached?.products.find((p) => p.slug === slug);
  if (!hit) return null;

  return {
    ...hit,
    status: ProductStatus.ACTIVE,
    deletedAt: null,
    environmentId: cached!.id,
    videos: [],
    category: null,
    subcategory: null,
    environment: { slug: environmentSlug, name: cached!.name },
    tags: [],
    createdAt: new Date(hit.createdAt),
    updatedAt: new Date(hit.createdAt),
    prices: hit.prices.map((p) => ({
      ...p,
      saleStart: p.saleStart ? new Date(p.saleStart) : null,
      saleEnd: p.saleEnd ? new Date(p.saleEnd) : null,
    })),
  } as unknown as ProductWithRelations;
});

export async function getProductVariantFamily(
  product: ProductWithRelations
): Promise<ProductWithRelations[]> {
  if (!product.variantGroupKey) return [];

  const variants = await prisma.product.findMany({
    where: {
      environmentId: product.environmentId,
      variantGroupKey: product.variantGroupKey,
      status: ProductStatus.ACTIVE,
      deletedAt: null,
    },
    include: productInclude,
  });

  return variants.sort((a, b) =>
    compareVariantLabels(a.variantLabel, b.variantLabel)
  );
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
  limit = 8,
  environmentId?: string
) {
  const envId = environmentId ?? product.environmentId ?? undefined;
  const excludeId = product.id;

  const baseWhere: Prisma.ProductWhereInput = {
    status: ProductStatus.ACTIVE,
    deletedAt: null,
    isVariantPrimary: true,
    id: { not: excludeId },
    ...(product.variantGroupKey
      ? {
          AND: [
            {
              OR: [
                { variantGroupKey: null },
                { variantGroupKey: { not: product.variantGroupKey } },
              ],
            },
          ],
        }
      : {}),
    ...(envId ? { environmentId: envId } : {}),
  };

  const shopFilter: Prisma.ProductWhereInput | null = product.shopCategorySlug
    ? { shopCategorySlug: product.shopCategorySlug }
    : null;

  const fallbackAffinity: Prisma.ProductWhereInput[] = [
    ...(product.subcategoryId ? [{ subcategoryId: product.subcategoryId }] : []),
    ...(product.categoryId ? [{ categoryId: product.categoryId }] : []),
    ...(product.brandId ? [{ brandId: product.brandId }] : []),
  ];
  if (!shopFilter && fallbackAffinity.length === 0) return [];

  // One indexed query, then rank exact taxonomy matches in memory. This keeps
  // recommendations in the same exclusive shop category without sequential DB calls.
  const matches = await prisma.product.findMany({
    where: {
      ...baseWhere,
      ...(shopFilter ?? { OR: fallbackAffinity }),
    },
    include: productListInclude,
    orderBy: [{ isFeatured: "desc" }, { isBestseller: "desc" }, { createdAt: "desc" }],
    take: Math.max(limit * 4, 24),
  });

  return matches
    .map((item, index) => ({
      item,
      index,
      score:
        (item.subcategoryId && item.subcategoryId === product.subcategoryId ? 4 : 0) +
        (item.categoryId && item.categoryId === product.categoryId ? 2 : 0) +
        (item.brandId && item.brandId === product.brandId ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(({ item }) => item);
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
