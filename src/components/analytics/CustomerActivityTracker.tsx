"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackCustomerInquiry } from "@/lib/track-inquiry";

interface CustomerActivityTrackerProps {
  environmentSlug?: string;
  environmentName?: string;
}

const VIEWED_PREFIX = "tfrc-activity-view:";

/**
 * Records one anonymous view per URL per browser-tab session.
 * This captures genuine catalogue interest without flooding the activity list
 * when React re-renders or the same route is revisited in one session.
 */
export function CustomerActivityTracker({
  environmentSlug,
  environmentName,
}: CustomerActivityTrackerProps = {}) {
  const pathname = usePathname();

  useEffect(() => {
    const pagePath = `${pathname}${window.location.search}`;
    const viewedKey = `${VIEWED_PREFIX}${pagePath}`;

    try {
      if (sessionStorage.getItem(viewedKey)) return;
      sessionStorage.setItem(viewedKey, "1");
    } catch {
      // Tracking still works when sessionStorage is restricted.
    }

    trackCustomerInquiry({
      eventType: "PAGE_VIEW",
      environmentSlug,
      environmentName,
      pagePath,
      metadata: {
        title: document.title,
        language: navigator.language,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      },
    });
  }, [environmentName, environmentSlug, pathname]);

  return null;
}
