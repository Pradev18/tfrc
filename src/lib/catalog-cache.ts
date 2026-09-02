import fs from "fs";
import path from "path";

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
  description: string | null;
  shortDescription: string | null;
  isFeatured: boolean;
  createdAt: string;
  images: Array<{ url: string; sortOrder?: number; isPrimary?: boolean }>;
  prices: Array<{
    type: string;
    amount: number;
    currency: string;
    saleStart?: string | null;
    saleEnd?: string | null;
  }>;
  brand: CachedBrand | null;
  inventory: { isInStock: boolean } | null;
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

interface CatalogCache {
  generatedAt: string;
  environments: Record<string, CachedEnvironment>;
}

let cached: CatalogCache | null | undefined;

function candidateCachePaths(): string[] {
  const cwd = process.cwd();
  return [
    path.join(cwd, "data", "catalog-cache.json"),
    path.join(cwd, "catalog-cache.json"),
    path.join(cwd, ".next", "catalog-cache.json"),
    path.join(cwd, "..", "data", "catalog-cache.json"),
    path.join(cwd, "..", "catalog-cache.json"),
  ];
}

export function loadCatalogCache(): CatalogCache | null {
  if (cached !== undefined) return cached;

  for (const file of candidateCachePaths()) {
    try {
      if (!fs.existsSync(file)) continue;
      const raw = fs.readFileSync(file, "utf8");
      cached = JSON.parse(raw) as CatalogCache;
      return cached;
    } catch {
      /* try next */
    }
  }

  cached = null;
  return null;
}

export function getCachedEnvironment(slug: string): CachedEnvironment | null {
  const cache = loadCatalogCache();
  return cache?.environments[slug] ?? null;
}

export function getCachedProducts(
  slug: string,
  opts: { page?: number; limit?: number; q?: string; brandSlug?: string; onSale?: boolean } = {}
) {
  const env = getCachedEnvironment(slug);
  if (!env) return null;

  let items = [...env.products];
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
    items = items.filter((p) => p.prices.some((price) => price.type === "SALE"));
  }

  const page = opts.page ?? 1;
  const limit = opts.limit ?? 24;
  const start = (page - 1) * limit;
  const slice = items.slice(start, start + limit);

  return {
    items: slice,
    total: items.length,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(items.length / limit)),
  };
}
