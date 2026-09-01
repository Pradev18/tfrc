export interface EffectivePrice {
  regular: number;
  sale: number | null;
  currency: string;
  isOnSale: boolean;
  discountPercent: number | null;
  displayPrice: number;
}

interface PriceInput {
  regular: number;
  sale?: number | null;
  currency?: string;
  saleStart?: Date | null;
  saleEnd?: Date | null;
}

export function validatePrices(regular: number, sale?: number | null): void {
  if (regular <= 0) throw new Error("Regular price must be greater than zero");
  if (sale != null && sale > 0 && sale >= regular) {
    throw new Error("Sale price must be less than regular price");
  }
}

export function isSaleActive(saleStart?: Date | null, saleEnd?: Date | null): boolean {
  const now = new Date();
  if (saleStart && now < saleStart) return false;
  if (saleEnd && now > saleEnd) return false;
  return true;
}

export function getEffectivePrice(input: PriceInput): EffectivePrice {
  const currency = input.currency ?? "QAR";
  const regular = input.regular;
  let sale: number | null = input.sale ?? null;

  if (sale != null && sale > 0) {
    if (sale >= regular) sale = null;
    else if (!isSaleActive(input.saleStart, input.saleEnd)) sale = null;
  } else {
    sale = null;
  }

  const isOnSale = sale != null && sale < regular;
  const discountPercent = isOnSale
    ? Math.round(((regular - sale!) / regular) * 100)
    : null;

  return {
    regular,
    sale,
    currency,
    isOnSale,
    discountPercent,
    displayPrice: isOnSale ? sale! : regular,
  };
}

export function formatPriceDisplay(price: EffectivePrice): {
  regular: string;
  sale: string | null;
  display: string;
  discount: string | null;
} {
  const fmt = (n: number) => `${price.currency} ${n.toFixed(2)}`;
  return {
    regular: fmt(price.regular),
    sale: price.isOnSale && price.sale ? fmt(price.sale) : null,
    display: fmt(price.displayPrice),
    discount: price.discountPercent ? `${price.discountPercent}% OFF` : null,
  };
}
