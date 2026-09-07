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

interface FeedPayload {
  items: ProductListItem[];
  total: number;
  page: number;
  totalPages: number;
}

const FEED_CACHE_TTL_MS = 2 * 60_000;
const feedCache = new Map<string, { data: FeedPayload; storedAt: number }>();
const prefetching = new Map<string, Promise<FeedPayload | null>>();

const initialState: FeedState = {
  items: [],
  total: 0,
  page: 0,
  totalPages: 0,
  loading: true,
  loadingMore: false,
  error: null,
};

function buildFeedUrl(
  environmentSlug: string,
  filters: StoreFilters,
  shopSlug: string | undefined,
  page: number,
  onSaleOnly?: boolean,
  includeVariants?: boolean
) {
  const params = filtersToSearchParams(filters);
  if (shopSlug) params.set("shop", shopSlug);
  if (onSaleOnly) params.set("sale", "true");
  if (includeVariants) params.set("allVariants", "true");
  params.set("page", String(page));
  params.set("limit", String(STORE_PAGE_SIZE));
  return `/api/store/${environmentSlug}/products?${params.toString()}`;
}

function readFeedCache(url: string): FeedPayload | null {
  const hit = feedCache.get(url);
  if (!hit) return null;
  if (Date.now() - hit.storedAt > FEED_CACHE_TTL_MS) {
    feedCache.delete(url);
    return null;
  }
  return hit.data;
}

export function prefetchStoreFeed(
  environmentSlug: string,
  filters: StoreFilters,
  options?: {
    shopSlug?: string;
    onSaleOnly?: boolean;
    includeVariants?: boolean;
  }
) {
  const url = buildFeedUrl(
    environmentSlug,
    filters,
    options?.shopSlug,
    1,
    options?.onSaleOnly,
    options?.includeVariants
  );
  if (readFeedCache(url) || prefetching.has(url)) return;

  const request = fetch(url)
    .then(async (response) => {
      if (!response.ok) return null;
      const data = (await response.json()) as FeedPayload;
      feedCache.set(url, { data, storedAt: Date.now() });
      return data;
    })
    .catch(() => null)
    .finally(() => {
      prefetching.delete(url);
    });
  prefetching.set(url, request);
}

export function useStoreProductFeed(
  environmentSlug: string,
  filters: StoreFilters,
  options?: {
    shopSlug?: string;
    onSaleOnly?: boolean;
    enabled?: boolean;
    includeVariants?: boolean;
  }
) {
  const {
    shopSlug,
    onSaleOnly = false,
    enabled = true,
    includeVariants = false,
  } = options ?? {};
  const [state, setState] = useState<FeedState>(() => ({
    ...initialState,
    // Fresh mount must look like loading — never flash "No products found".
    loading: enabled,
  }));
  const abortRef = useRef<AbortController | null>(null);
  const filtersKey = JSON.stringify({ filters, shopSlug, onSaleOnly, includeVariants });

  const fetchPage = useCallback(
    async (page: number, append: boolean, force = false) => {
      if (!enabled) return;

      const url = buildFeedUrl(
        environmentSlug,
        filters,
        shopSlug,
        page,
        onSaleOnly,
        includeVariants
      );
      const cached = !force ? readFeedCache(url) : null;
      if (cached) {
        setState((current) => ({
          items: append ? [...current.items, ...cached.items] : cached.items,
          total: cached.total,
          page: cached.page,
          totalPages: cached.totalPages,
          loading: false,
          loadingMore: false,
          error: null,
        }));
        return;
      }

      const pendingPrefetch = !force ? prefetching.get(url) : null;
      if (pendingPrefetch) {
        const data = await pendingPrefetch;
        if (data) {
          setState({
            items: data.items,
            total: data.total,
            page: data.page,
            totalPages: data.totalPages,
            loading: false,
            loadingMore: false,
            error: null,
          });
          return;
        }
      }

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
        const res = await fetch(url, {
          signal: controller.signal,
          cache: force ? "reload" : "default",
        });

        if (!res.ok) throw new Error("Failed to load");

        const data = (await res.json()) as FeedPayload;
        feedCache.set(url, { data, storedAt: Date.now() });

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
    [enabled, environmentSlug, filters, shopSlug, onSaleOnly, includeVariants]
  );

  useEffect(() => {
    if (!enabled) {
      setState({ ...initialState, loading: false });
      return;
    }
    setState((current) => ({
      ...current,
      loading: current.items.length === 0,
      loadingMore: false,
      error: null,
    }));
    fetchPage(1, false);
    return () => abortRef.current?.abort();
  }, [enabled, filtersKey, fetchPage]);

  useEffect(() => {
    if (!enabled) return;
    const refreshFeed = () => {
      feedCache.clear();
      void fetchPage(1, false, true);
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
