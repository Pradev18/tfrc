"use client";

import { useEffect } from "react";
import { trackMetaViewContent } from "@/components/analytics/MetaPixel";

interface ProductViewTrackerProps {
  productId: string;
  name: string;
  price: number;
  currency: string;
}

export function ProductViewTracker({
  productId,
  name,
  price,
  currency,
}: ProductViewTrackerProps) {
  useEffect(() => {
    trackMetaViewContent({
      contentId: productId,
      contentName: name,
      value: price,
      currency,
    });
  }, [productId, name, price, currency]);

  return null;
}
