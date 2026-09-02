"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL_MS = 10_000;

export function announceSiteDataUpdate() {
  window.dispatchEvent(new Event("site-data-refresh"));
  try {
    localStorage.setItem("site-data-updated", String(Date.now()));
  } catch {
    // Storage can be disabled; the current tab still refreshes directly.
  }
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
        const response = await fetch("/api/site-revision", {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) return;
        const data = (await response.json()) as { revision?: string | null };
        if (!data.revision) return;

        if (revisionRef.current && revisionRef.current !== data.revision) {
          window.dispatchEvent(new Event("site-data-refresh"));
          router.refresh();
        }
        revisionRef.current = data.revision;
      } finally {
        checkingRef.current = false;
      }
    }

    function refreshFromAnotherTab() {
      window.dispatchEvent(new Event("site-data-refresh"));
      router.refresh();
      void checkRevision();
    }

    void checkRevision();
    const interval = window.setInterval(checkRevision, POLL_INTERVAL_MS);
    window.addEventListener("storage", refreshFromAnotherTab);
    document.addEventListener("visibilitychange", checkRevision);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", refreshFromAnotherTab);
      document.removeEventListener("visibilitychange", checkRevision);
    };
  }, [router]);

  return null;
}
