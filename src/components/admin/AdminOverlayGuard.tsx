"use client";

import { useEffect } from "react";

/**
 * Clears scroll-lock / leftover dim layers if a storefront menu was open
 * before navigating into admin (or after a stuck mobile drawer).
 */
export function AdminOverlayGuard() {
  useEffect(() => {
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
  }, []);

  return null;
}
