"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/** Keep open tabs roughly in sync without thrashing RSC / product grids */
const ADMIN_POLL_INTERVAL_MS = 60_000;
const STORE_POLL_INTERVAL_MS = 180_000;
const REFRESH_DEBOUNCE_MS = 400;

export function announceSiteDataUpdate() {
  try {
    localStorage.setItem("site-data-updated", String(Date.now()));
  } catch {
    // Storage can be disabled; the current tab still refreshes directly.
  }
  window.dispatchEvent(
    new CustomEvent("site-data-refresh", { detail: { immediate: true } })
  );
}

export function LiveDataRefresh() {
  const router = useRouter();
  const revisionRef = useRef<string | null>(null);
  const checkingRef = useRef(false);
  const refreshTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const isAdmin =
      typeof window !== "undefined" && window.location.pathname.startsWith("/admin");
    const pollInterval = isAdmin ? ADMIN_POLL_INTERVAL_MS : STORE_POLL_INTERVAL_MS;

    function scheduleRouterRefresh(immediate = false) {
      if (refreshTimerRef.current != null) {
        window.clearTimeout(refreshTimerRef.current);
      }
      refreshTimerRef.current = window.setTimeout(() => {
        refreshTimerRef.current = null;
        router.refresh();
      }, immediate ? 0 : REFRESH_DEBOUNCE_MS);
    }

    async function checkRevision() {
      if (checkingRef.current || document.visibilityState === "hidden") return;
      checkingRef.current = true;
      try {
        const response = await fetch(`/api/site-revision?_=${Date.now()}`, {
          cache: "no-store",
          headers: { Accept: "application/json", "Cache-Control": "no-store" },
        });
        if (!response.ok) return;
        const data = (await response.json()) as { revision?: string | null };
        if (!data.revision) return;

        const previous = revisionRef.current;
        revisionRef.current = data.revision;
        if (previous && previous !== data.revision) {
          window.dispatchEvent(
            new CustomEvent("site-data-refresh", { detail: { immediate: false } })
          );
        }
      } finally {
        checkingRef.current = false;
      }
    }

    function onSiteDataRefresh(event: Event) {
      const immediate = Boolean(
        (event as CustomEvent<{ immediate?: boolean }>).detail?.immediate
      );
      scheduleRouterRefresh(immediate);
    }

    function onStorage(event: StorageEvent) {
      if (event.key !== "site-data-updated") return;
      window.dispatchEvent(
        new CustomEvent("site-data-refresh", { detail: { immediate: true } })
      );
      void checkRevision();
    }

    void checkRevision();
    const interval = window.setInterval(checkRevision, pollInterval);
    window.addEventListener("storage", onStorage);
    window.addEventListener("site-data-refresh", onSiteDataRefresh);
    document.addEventListener("visibilitychange", checkRevision);

    return () => {
      window.clearInterval(interval);
      if (refreshTimerRef.current != null) {
        window.clearTimeout(refreshTimerRef.current);
      }
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("site-data-refresh", onSiteDataRefresh);
      document.removeEventListener("visibilitychange", checkRevision);
    };
  }, [router]);

  return null;
}
