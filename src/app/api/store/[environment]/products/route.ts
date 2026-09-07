import { NextRequest, NextResponse } from "next/server";
import { isValidEnvironmentSlug } from "@/services/environment.service";
import { getProducts } from "@/services/product.service";
import { STORE_MAX_PAGE_SIZE, STORE_PAGE_SIZE } from "@/lib/store-constants";
import type { StoreSort } from "@/lib/store-catalog-filter";

const SORT_VALUES: StoreSort[] = [
  "featured",
  "newest",
  "price_asc",
  "price_desc",
  "discount",
  "name",
];

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ environment: string }> }
) {
  const { environment } = await context.params;

  try {
    if (!(await isValidEnvironmentSlug(environment))) {
      return NextResponse.json({ error: "Invalid environment" }, { status: 404 });
    }

    const sp = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
    const limit = Math.min(
      STORE_MAX_PAGE_SIZE,
      Math.max(1, parseInt(sp.get("limit") ?? String(STORE_PAGE_SIZE), 10) || STORE_PAGE_SIZE)
    );
    const sortParam = sp.get("sort") as StoreSort | null;
    const sort = sortParam && SORT_VALUES.includes(sortParam) ? sortParam : "newest";

    const result = await getProducts({
      environmentSlug: environment,
      search: sp.get("q") ?? undefined,
      shopCategorySlug: sp.get("shop") ?? undefined,
      brandSlug: sp.get("brand") ?? undefined,
      onSale: sp.get("sale") === "true",
      inStock: sp.get("inStock") === "true",
      sort,
      page,
      limit,
      listMode: true,
      includeVariants: sp.get("allVariants") === "true",
    });

    const isSearch = Boolean(sp.get("q"));
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": isSearch
          ? "private, max-age=15"
          : "public, max-age=30, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("[store-products]", error);
    return NextResponse.json(
      {
        error: "Failed to load products",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
