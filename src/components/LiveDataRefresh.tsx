"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL_MS = 4_000;

export function announceSiteDataUpdate() {
  try {
    localStorage.setItem("site-data-updated", String(Date.now()));
  } catch {
    // Storage can be disabled; the current tab still refreshes directly.
  }
  window.dispatchEvent(new Event("site-data-refresh"));
}

export function LiveDataRefresh() {
  const router = useRouter();
  const revisionRef = useRef<string | null>(null);
  const checkingRef = useRef(false);

  useEffect(() => {
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
          // Keep product grids + RSC trees in sync across open tabs.
          window.dispatchEvent(new Event("site-data-refresh"));
          router.refresh();
        }
      } finally {
        checkingRef.current = false;
      }
    }

    function onSiteDataRefresh() {
      router.refresh();
    }

    function onStorage(event: StorageEvent) {
      if (event.key !== "site-data-updated") return;
      window.dispatchEvent(new Event("site-data-refresh"));
      router.refresh();
      void checkRevision();
    }

    void checkRevision();
    const interval = window.setInterval(checkRevision, POLL_INTERVAL_MS);
    window.addEventListener("storage", onStorage);
    window.addEventListener("site-data-refresh", onSiteDataRefresh);
    document.addEventListener("visibilitychange", checkRevision);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("site-data-refresh", onSiteDataRefresh);
      document.removeEventListener("visibilitychange", checkRevision);
    };
  }, [router]);

  return null;
}
