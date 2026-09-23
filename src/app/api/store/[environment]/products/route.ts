import { NextRequest, NextResponse } from "next/server";
import { isValidEnvironmentSlug, resolveEnvironment } from "@/services/environment.service";
import { getProducts } from "@/services/product.service";
import { STORE_MAX_PAGE_SIZE, STORE_PAGE_SIZE } from "@/lib/store-constants";
import type { StoreSort } from "@/lib/store-catalog-filter";
import {
  hasCatalogueUnlockCookie,
  isCatalogueLockedFromSettings,
  getCatalogueLockState,
} from "@/lib/catalogue-lock";

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

    const env = await resolveEnvironment(environment);
    if (env && !env.id.startsWith("static-")) {
      const lockState = await getCatalogueLockState(env.id);
      const locked =
        lockState.isLocked || isCatalogueLockedFromSettings(env.settings);
      if (locked && !(await hasCatalogueUnlockCookie(env.id))) {
        return NextResponse.json(
          {
            error: "This catalogue is locked. Enter the catalogue password to continue.",
            locked: true,
            items: [],
            total: 0,
            page: 1,
            limit: STORE_PAGE_SIZE,
            totalPages: 0,
          },
          {
            status: 423,
            headers: {
              "Cache-Control": "private, no-store, max-age=0",
            },
          }
        );
      }
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

    return NextResponse.json(result, {
      headers: {
        // The file cache already makes this route fast. CDN caching caused
        // stale empty category feeds to survive catalogue updates/deployments.
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("[store-products]", error);
    // Never hard-crash the shop UI — empty feed is better than Application error.
    return NextResponse.json(
      {
        items: [],
        total: 0,
        page: 1,
        limit: STORE_PAGE_SIZE,
        totalPages: 0,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      }
    );
  }
}
