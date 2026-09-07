/** Money arithmetic in minor units to avoid floating-point total drift. */
export function calculateLineTotal(unitPrice: number, quantity: number): number {
  const unitMinor = Math.round(unitPrice * 100);
  const safeQuantity = Math.max(1, Math.floor(quantity || 1));
  return (unitMinor * safeQuantity) / 100;
}

export function calculateOrderTotal(
  items: Array<{ price: number; quantity?: number }>
): number {
  const totalMinor = items.reduce(
    (sum, item) =>
      sum +
      Math.round(item.price * 100) *
        Math.max(1, Math.floor(item.quantity ?? 1)),
    0
  );
  return totalMinor / 100;
}
