/**
 * WhatsApp Business Catalog deep links (Meta Commerce).
 * Product IDs must match your Meta/WhatsApp catalog (same as product.productId in feeds).
 *
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/guides/sell-products-and-services/
 */

export function cleanWhatsAppPhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** Opens your full WhatsApp Business catalog storefront */
export function buildWhatsAppCatalogStoreUrl(phoneNumber: string): string {
  return `https://wa.me/c/${cleanWhatsAppPhone(phoneNumber)}`;
}

/** Opens a single product inside WhatsApp Business catalog (customer can tap Add to Cart) */
export function buildWhatsAppCatalogProductUrl(
  phoneNumber: string,
  catalogProductId: string
): string {
  const id = encodeURIComponent(catalogProductId.trim());
  return `https://wa.me/p/${id}/${cleanWhatsAppPhone(phoneNumber)}`;
}

export interface CatalogCartItem {
  productId: string;
  name: string;
  displayPrice: number;
  currency?: string;
}

/** Build checkout URL — single item opens catalog product directly */
export function buildSingleCatalogProductCheckoutUrl(
  phoneNumber: string,
  productId: string
): string {
  return buildWhatsAppCatalogProductUrl(phoneNumber, productId);
}
