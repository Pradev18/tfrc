import { mapProductPrices, type ProductWithRelations } from "@/services/product.service";

/** Deterministic day index for rotating deals (changes daily, stable within a day) */
export function getDayIndex(date = new Date()): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86_400_000);
}

export function formatTodaysDealDate(date = new Date()): string {
  return date.toLocaleDateString("en-QA", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** Pick today's deals from sale products — rotates daily, highest discount first */
export function pickTodaysDeals(
  products: ProductWithRelations[],
  limit: number,
  dayIndex = getDayIndex()
): ProductWithRelations[] {
  const onSale = products
    .map((p) => ({ p, pricing: mapProductPrices(p).pricing }))
    .filter(({ pricing }) => pricing.isOnSale)
    .sort((a, b) => (b.pricing.discountPercent ?? 0) - (a.pricing.discountPercent ?? 0));

  if (onSale.length === 0) return [];

  const offset = onSale.length <= limit ? 0 : dayIndex % (onSale.length - limit + 1);
  return onSale.slice(offset, offset + limit).map(({ p }) => p);
}

export function getBestDiscountPercent(products: ProductWithRelations[]): number | null {
  let best = 0;
  for (const p of products) {
    const d = mapProductPrices(p).pricing.discountPercent ?? 0;
    if (d > best) best = d;
  }
  return best > 0 ? best : null;
}
