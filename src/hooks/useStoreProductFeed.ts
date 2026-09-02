"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProductListItem } from "@/services/product.service";
import { STORE_PAGE_SIZE } from "@/lib/store-constants";
import type { StoreFilters } from "@/lib/store-catalog-filter";
import { filtersToSearchParams } from "@/lib/store-catalog-filter";

interface FeedState {
  items: ProductListItem[];
  total: number;
  page: number;
  totalPages: number;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
}

const initialState: FeedState = {
  items: [],
  total: 0,
  page: 0,
  totalPages: 0,
  loading: false,
  loadingMore: false,
  error: null,
};

function buildFeedUrl(
  environmentSlug: string,
  filters: StoreFilters,
  shopSlug: string | undefined,
  page: number,
  onSaleOnly?: boolean
) {
  const params = filtersToSearchParams(filters);
  if (shopSlug) params.set("shop", shopSlug);
  if (onSaleOnly) params.set("sale", "true");
  params.set("page", String(page));
  params.set("limit", String(STORE_PAGE_SIZE));
  return `/api/store/${environmentSlug}/products?${params.toString()}`;
}

export function useStoreProductFeed(
  environmentSlug: string,
  filters: StoreFilters,
  options?: {
    shopSlug?: string;
    onSaleOnly?: boolean;
    enabled?: boolean;
  }
) {
  const { shopSlug, onSaleOnly = false, enabled = true } = options ?? {};
  const [state, setState] = useState<FeedState>(initialState);
  const abortRef = useRef<AbortController | null>(null);
  const filtersKey = JSON.stringify({ filters, shopSlug, onSaleOnly });

  const fetchPage = useCallback(
    async (page: number, append: boolean) => {
      if (!enabled) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setState((s) => ({
        ...s,
        loading: !append,
        loadingMore: append,
        error: null,
      }));

      try {
        const res = await fetch(
          `${buildFeedUrl(environmentSlug, filters, shopSlug, page, onSaleOnly)}&_=${Date.now()}`,
          { signal: controller.signal, cache: "no-store" }
        );

        if (!res.ok) throw new Error("Failed to load");

        const data = (await res.json()) as {
          items: ProductListItem[];
          total: number;
          page: number;
          totalPages: number;
        };

        setState((s) => ({
          items: append ? [...s.items, ...data.items] : data.items,
          total: data.total,
          page: data.page,
          totalPages: data.totalPages,
          loading: false,
          loadingMore: false,
          error: null,
        }));
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setState((s) => ({
          ...s,
          loading: false,
          loadingMore: false,
          error: "Could not load products. Try again.",
        }));
      }
    },
    [enabled, environmentSlug, filters, shopSlug, onSaleOnly]
  );

  useEffect(() => {
    if (!enabled) {
      setState(initialState);
      return;
    }
    fetchPage(1, false);
    return () => abortRef.current?.abort();
  }, [enabled, filtersKey, fetchPage]);

  useEffect(() => {
    if (!enabled) return;
    const refreshFeed = () => {
      void fetchPage(1, false);
    };
    window.addEventListener("site-data-refresh", refreshFeed);
    return () => window.removeEventListener("site-data-refresh", refreshFeed);
  }, [enabled, fetchPage]);

  const loadMore = useCallback(() => {
    if (state.loading || state.loadingMore || state.page >= state.totalPages) return;
    fetchPage(state.page + 1, true);
  }, [fetchPage, state.loading, state.loadingMore, state.page, state.totalPages]);

  return { ...state, loadMore, refresh: () => fetchPage(1, false) };
}
