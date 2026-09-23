import fs from "fs";
import path from "path";
import {
  OTHER_SHOP_CATEGORY,
  resolvePrimaryShopCategory,
  type ShopCategoryDef,
} from "@/lib/shop-categories";
import { compareVariantLabels } from "@/lib/product-variants";

export interface CachedBrand {
  id: string;
  name: string;
  slug: string;
}

export interface CachedProduct {
  id: string;
  productId: string;
  name: string;
  slug: string;
  sku: string | null;
  itemNo?: number | null;
  description: string | null;
  shortDescription: string | null;
  isFeatured: boolean;
  variantGroupKey?: string | null;
  variantLabel?: string | null;
  isVariantPrimary?: boolean;
  shopCategorySlug?: string | null;
  condition?: string | null;
  gtin?: string | null;
  weight?: string | null;
  dimensions?: string | null;
  shippingInfo?: string | null;
  googleCategory?: string | null;
  fbCategory?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  brandId?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  createdAt: string;
  images: Array<{ url: string; sortOrder?: number; isPrimary?: boolean }>;
  videos?: Array<{ url: string; sortOrder?: number }>;
  prices: Array<{
    type: string;
    amount: number;
    currency: string;
    saleStart?: string | null;
    saleEnd?: string | null;
  }>;
  brand: CachedBrand | null;
  inventory: { isInStock: boolean } | null;
  category?: { id: string; name: string; slug: string } | null;
  subcategory?: { id: string; name: string; slug: string } | null;
}

export interface CachedEnvironment {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  logoUrl: string | null;
  icon: string | null;
  theme: string;
  seo: string;
  settings: string;
  departmentSource: string | null;
  brands: CachedBrand[];
  products: CachedProduct[];
}

export interface CatalogCache {
  generatedAt: string;
  environments: Record<string, CachedEnvironment>;
}

let cached: CatalogCache | null | undefined;
let cachedFile: string | null = null;
let cachedMtime = 0;

function candidateCachePaths(): string[] {
  const cwd = process.cwd();
  return [
    path.join(cwd, "data", "catalog-cache.json"),
    path.join(cwd, "catalog-cache.json"),
    path.join(cwd, ".next", "catalog-cache.json"),
    path.join(cwd, ".next", "standalone", "data", "catalog-cache.json"),
    path.join(cwd, ".next", "standalone", "catalog-cache.json"),
    path.join(cwd, "..", "data", "catalog-cache.json"),
    path.join(cwd, "..", "catalog-cache.json"),
  ];
}

function primaryCacheWritePaths(): string[] {
  const cwd = process.cwd();
  return [
    path.join(cwd, "data", "catalog-cache.json"),
    path.join(cwd, "catalog-cache.json"),
    path.join(cwd, ".next", "catalog-cache.json"),
    path.join(cwd, ".next", "standalone", "data", "catalog-cache.json"),
    path.join(cwd, ".next", "standalone", "catalog-cache.json"),
  ];
}

export function invalidateCatalogCacheMemory(): void {
  cached = undefined;
  cachedFile = null;
  cachedMtime = 0;
}

export function loadCatalogCache(): CatalogCache | null {
  for (const file of candidateCachePaths()) {
    try {
      if (!fs.existsSync(file)) continue;
      const mtime = fs.statSync(file).mtimeMs;
      if (cached !== undefined && cachedFile === file && cachedMtime === mtime) {
        return cached;
      }
      const raw = fs.readFileSync(file, "utf8");
      cached = JSON.parse(raw) as CatalogCache;
      cachedFile = file;
      cachedMtime = mtime;
      return cached;
    } catch {
      /* try next */
    }
  }

  cached = null;
  cachedFile = null;
  cachedMtime = 0;
  return null;
}

export function saveCatalogCache(nextCache: CatalogCache): void {
  cached = nextCache;
  const payload = JSON.stringify(nextCache);
  let wrote = false;

  for (const file of [...new Set([...primaryCacheWritePaths(), ...candidateCachePaths()])]) {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const temporary = `${file}.${process.pid}.tmp`;
      fs.writeFileSync(temporary, payload);
      fs.renameSync(temporary, file);
      if (!wrote) {
        cachedFile = file;
        cachedMtime = fs.statSync(file).mtimeMs;
        wrote = true;
      }
    } catch (error) {
      console.warn(`[catalog-cache] Could not refresh ${file}:`, error);
    }
  }

  if (!wrote) {
    console.error("[catalog-cache] Failed to persist catalogue cache to disk");
  }
}

export function getCachedEnvironment(slug: string): CachedEnvironment | null {
  const cache = loadCatalogCache();
  return cache?.environments[slug] ?? null;
}

export function removeCachedEnvironment(slug: string): void {
  const cache = loadCatalogCache();
  if (cache?.environments[slug]) {
    delete cache.environments[slug];
  }
}

type CatalogCacheSort =
  | "featured"
  | "newest"
  | "price_asc"
  | "price_desc"
  | "discount"
  | "name"
  | "item_no_asc"
  | "item_no_desc"
  | "item_code_asc"
  | "item_code_desc";

export function getCachedProducts(
  slug: string,
  opts: {
    page?: number;
    limit?: number;
    q?: string;
    brandSlug?: string;
    onSale?: boolean;
    inStock?: boolean;
    shopSlug?: string | null;
    shopDefs?: ShopCategoryDef[];
    includeVariants?: boolean;
    sort?: CatalogCacheSort;
  } = {}
) {
  const env = getCachedEnvironment(slug);
  if (!env) return null;

  let items = opts.includeVariants
    ? [...env.products]
    : env.products.filter((product) => product.isVariantPrimary !== false);
  const q = opts.q?.trim().toLowerCase();
  if (q) {
    items = items.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.productId.toLowerCase().includes(q) ||
        (p.sku?.toLowerCase().includes(q) ?? false)
    );
  }
  if (opts.brandSlug) {
    items = items.filter((p) => p.brand?.slug === opts.brandSlug);
  }
  if (opts.onSale) {
    items = items.filter((p) =>
      (p.prices ?? []).some((price) => price.type === "SALE")
    );
  }
  if (opts.inStock) {
    items = items.filter((p) => p.inventory?.isInStock === true);
  }
  if (opts.shopSlug) {
    items = items.filter((product) => {
      // The storefront category index is derived from the same definitions.
      // Use identical matching here so a stale saved slug can never produce a
      // category count with an empty product grid.
      if (opts.shopDefs) {
        const primary = resolvePrimaryShopCategory(
          { name: product.name },
          opts.shopDefs
        );
        if (opts.shopSlug === OTHER_SHOP_CATEGORY.slug) return primary == null;
        return primary?.slug === opts.shopSlug;
      }

      if (product.shopCategorySlug !== undefined) {
        if (opts.shopSlug === OTHER_SHOP_CATEGORY.slug) {
          return (
            !product.shopCategorySlug ||
            product.shopCategorySlug === OTHER_SHOP_CATEGORY.slug
          );
        }
        return product.shopCategorySlug === opts.shopSlug;
      }
      return true;
    });
  }

  if (opts.sort) {
    items = sortCachedProducts(items, opts.sort);
  }

  const page = opts.page ?? 1;
  const limit = opts.limit ?? 24;
  const start = (page - 1) * limit;
  const slice = items.slice(start, start + limit);

  const siblingsByGroup = new Map<string, CachedProduct[]>();
  for (const product of env.products) {
    if (!product.variantGroupKey) continue;
    const siblings = siblingsByGroup.get(product.variantGroupKey) ?? [];
    siblings.push(product);
    siblingsByGroup.set(product.variantGroupKey, siblings);
  }
  for (const siblings of siblingsByGroup.values()) {
    siblings.sort((a, b) =>
      compareVariantLabels(a.variantLabel ?? null, b.variantLabel ?? null)
    );
  }

  return {
    items: slice.map((item) => ({
      ...item,
      images: item.images ?? [],
      videos: item.videos ?? [],
      prices: item.prices ?? [],
      sizeVariants: item.variantGroupKey
        ? (siblingsByGroup.get(item.variantGroupKey) ?? []).map((variant) => ({
            ...variant,
            images: variant.images ?? [],
            videos: variant.videos ?? [],
            prices: variant.prices ?? [],
          }))
        : [],
    })),
    total: items.length,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(items.length / limit)),
  };
}

function sortCachedProducts(
  products: CachedProduct[],
  sort: CatalogCacheSort
): CachedProduct[] {
  const list = [...products];
  const priceOf = (p: CachedProduct) => {
    const sale = p.prices?.find((x) => x.type === "SALE")?.amount;
    const regular = p.prices?.find((x) => x.type === "REGULAR")?.amount;
    return sale ?? regular ?? 0;
  };
  const discountOf = (p: CachedProduct) => {
    const sale = p.prices?.find((x) => x.type === "SALE")?.amount;
    const regular = p.prices?.find((x) => x.type === "REGULAR")?.amount;
    if (sale == null || regular == null || regular <= 0) return 0;
    return ((regular - sale) / regular) * 100;
  };
  const itemNoCmp = (a: CachedProduct, b: CachedProduct, dir: "asc" | "desc") => {
    const an = a.itemNo;
    const bn = b.itemNo;
    if (an == null && bn == null) {
      return a.productId.localeCompare(b.productId, undefined, { numeric: true });
    }
    if (an == null) return 1;
    if (bn == null) return -1;
    const diff = an - bn;
    if (diff !== 0) return dir === "asc" ? diff : -diff;
    return a.productId.localeCompare(b.productId, undefined, { numeric: true });
  };

  switch (sort) {
    case "featured":
      return list.sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured));
    case "name":
      return list.sort((a, b) => a.name.localeCompare(b.name));
    case "price_asc":
      return list.sort((a, b) => priceOf(a) - priceOf(b));
    case "price_desc":
      return list.sort((a, b) => priceOf(b) - priceOf(a));
    case "discount":
      return list.sort((a, b) => discountOf(b) - discountOf(a));
    case "item_no_asc":
      return list.sort((a, b) => itemNoCmp(a, b, "asc"));
    case "item_no_desc":
      return list.sort((a, b) => itemNoCmp(a, b, "desc"));
    case "item_code_asc":
      return list.sort((a, b) =>
        a.productId.localeCompare(b.productId, undefined, { numeric: true })
      );
    case "item_code_desc":
      return list.sort((a, b) =>
        b.productId.localeCompare(a.productId, undefined, { numeric: true })
      );
    case "newest":
    default:
      return list.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }
}
