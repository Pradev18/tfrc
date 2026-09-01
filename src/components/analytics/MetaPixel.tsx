"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import { META_CONFIG } from "@/lib/site-config";

declare global {
  interface Window {
    fbq: (...args: unknown[]) => void;
    _fbq: (...args: unknown[]) => void;
  }
}

function MetaPixelInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pixelId = META_CONFIG.pixelId;

  useEffect(() => {
    if (!pixelId || typeof window.fbq !== "function") return;
    window.fbq("track", "PageView");
  }, [pathname, searchParams, pixelId]);

  if (!pixelId) return null;

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${pixelId}');
          fbq('track', 'PageView');
        `}
      </Script>
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}

export function MetaPixel() {
  if (!META_CONFIG.pixelId) return null;
  return (
    <Suspense fallback={null}>
      <MetaPixelInner />
    </Suspense>
  );
}

export function trackMetaViewContent(data: {
  contentId: string;
  contentName: string;
  value: number;
  currency: string;
}) {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  window.fbq("track", "ViewContent", {
    content_ids: [data.contentId],
    content_name: data.contentName,
    content_type: "product",
    value: data.value,
    currency: data.currency,
  });
}

export function trackMetaAddToCart(data: {
  contentId: string;
  contentName: string;
  value: number;
  currency: string;
}) {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  window.fbq("track", "AddToCart", {
    content_ids: [data.contentId],
    content_name: data.contentName,
    content_type: "product",
    value: data.value,
    currency: data.currency,
  });
}

export function trackMetaInitiateCheckout(value: number, currency: string, numItems: number) {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  window.fbq("track", "InitiateCheckout", {
    value,
    currency,
    num_items: numItems,
  });
}
