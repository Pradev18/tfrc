import type { ProductWithRelations } from "@/services/product.service";
import { mapProductPrices } from "@/lib/pricing";
import {
  getEffectiveShopCategoryDefs,
  OTHER_SHOP_CATEGORY,
  resolvePrimaryShopCategory,
} from "@/lib/shop-categories";

export type StoreSort = "featured" | "newest" | "price_asc" | "price_desc" | "discount" | "name";
const STORE_SORTS = new Set<StoreSort>([
  "featured",
  "newest",
  "price_asc",
  "price_desc",
  "discount",
  "name",
]);

export interface StoreFilters {
  q: string;
  shop: string | null;
  brand: string | null;
  sale: boolean;
  inStock: boolean;
  sort: StoreSort;
}

export interface CategoryProductGroup {
  slug: string;
  name: string;
  products: ProductWithRelations[];
}

export const DEFAULT_STORE_FILTERS: StoreFilters = {
  q: "",
  shop: null,
  brand: null,
  sale: false,
  inStock: false,
  sort: "newest",
};

export function parseStoreFilters(params: Record<string, string | undefined>): StoreFilters {
  const requestedSort = params.sort as StoreSort | undefined;
  return {
    q: params.q?.trim() ?? "",
    shop: params.shop ?? null,
    brand: params.brand ?? null,
    sale: params.sale === "true",
    inStock: params.inStock === "true",
    sort: requestedSort && STORE_SORTS.has(requestedSort) ? requestedSort : "newest",
  };
}

export function sortProducts(
  products: ProductWithRelations[],
  sort: StoreSort
): ProductWithRelations[] {
  const list = [...products];

  switch (sort) {
    case "featured":
      return list.sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured));
    case "name":
      return list.sort((a, b) => a.name.localeCompare(b.name));
    case "price_asc":
      return list.sort(
        (a, b) => mapProductPrices(a).pricing.displayPrice - mapProductPrices(b).pricing.displayPrice
      );
    case "price_desc":
      return list.sort(
        (a, b) => mapProductPrices(b).pricing.displayPrice - mapProductPrices(a).pricing.displayPrice
      );
    case "discount":
      return list.sort(
        (a, b) =>
          (mapProductPrices(b).pricing.discountPercent ?? 0) -
          (mapProductPrices(a).pricing.discountPercent ?? 0)
      );
    case "newest":
    default:
      return list.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }
}

export function filterProducts(
  products: ProductWithRelations[],
  filters: StoreFilters
): ProductWithRelations[] {
  let result = products;

  if (filters.q) {
    const q = filters.q.toLowerCase();
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.productId.toLowerCase().includes(q) ||
        (p.brand?.name.toLowerCase().includes(q) ?? false) ||
        (p.sku?.toLowerCase().includes(q) ?? false)
    );
  }

  if (filters.brand) {
    result = result.filter((p) => p.brand?.slug === filters.brand);
  }

  if (filters.sale) {
    result = result.filter((p) => mapProductPrices(p).pricing.isOnSale);
  }

  if (filters.inStock) {
    result = result.filter((p) => p.inventory?.isInStock !== false);
  }

  return sortProducts(result, filters.sort);
}

export function groupProductsByShopCategory(
  products: ProductWithRelations[],
  environmentSlug: string
): CategoryProductGroup[] {
  const defs = getEffectiveShopCategoryDefs(
    environmentSlug,
    products.map((p) => p.name)
  );

  const buckets = new Map<string, ProductWithRelations[]>();
  for (const def of defs) buckets.set(def.slug, []);
  buckets.set(OTHER_SHOP_CATEGORY.slug, []);

  for (const product of products) {
    const primary = resolvePrimaryShopCategory(
      {
        name: product.name,
        googleCategory: (product as { googleCategory?: string | null }).googleCategory,
        fbCategory: (product as { fbCategory?: string | null }).fbCategory,
      },
      defs
    );
    const slug = primary?.slug ?? OTHER_SHOP_CATEGORY.slug;
    buckets.get(slug)!.push(product);
  }

  const groups: CategoryProductGroup[] = defs
    .map((def) => ({
      slug: def.slug,
      name: def.name,
      products: buckets.get(def.slug) ?? [],
    }))
    .filter((g) => g.products.length > 0);

  const other = buckets.get(OTHER_SHOP_CATEGORY.slug) ?? [];
  if (other.length > 0) {
    groups.push({
      slug: OTHER_SHOP_CATEGORY.slug,
      name: OTHER_SHOP_CATEGORY.name,
      products: other,
    });
  }

  return groups;
}

export function filtersToSearchParams(filters: StoreFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.shop) params.set("shop", filters.shop);
  if (filters.brand) params.set("brand", filters.brand);
  if (filters.sale) params.set("sale", "true");
  if (filters.inStock) params.set("inStock", "true");
  if (filters.sort !== "newest") params.set("sort", filters.sort);
  return params;
}
