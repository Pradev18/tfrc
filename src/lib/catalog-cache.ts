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

export function getCachedProducts(
  slug: string,
  opts: {
    page?: number;
    limit?: number;
    q?: string;
    brandSlug?: string;
    onSale?: boolean;
    inStock?: boolean;
    shopKeywords?: string[];
    excludeShopKeywords?: string[];
  } = {}
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
  if (opts.inStock) {
    items = items.filter((p) => p.inventory?.isInStock === true);
  }
  if (opts.shopKeywords?.length) {
    const keywords = opts.shopKeywords.map((keyword) => keyword.toLowerCase());
    items = items.filter((product) =>
      keywords.some((keyword) => product.name.toLowerCase().includes(keyword))
    );
  }
  if (opts.excludeShopKeywords?.length) {
    const keywords = opts.excludeShopKeywords.map((keyword) => keyword.toLowerCase());
    items = items.filter(
      (product) => !keywords.some((keyword) => product.name.toLowerCase().includes(keyword))
    );
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
