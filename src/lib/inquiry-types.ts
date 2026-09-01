export type InquiryEventType =
  | "ADD_TO_CART"
  | "REMOVE_FROM_CART"
  | "CART_CHECKOUT"
  | "PRODUCT_WHATSAPP"
  | "CATALOG_PRODUCT"
  | "MOBILE_ORDER_BAR"
  | "STICKY_BAR";

export interface InquiryItemPayload {
  productId: string;
  productName: string;
  slug: string;
  price: number;
  currency: string;
  environmentSlug?: string;
  environmentName?: string;
}

export interface TrackInquiryPayload {
  eventType: InquiryEventType;
  sessionId?: string;
  customerName?: string;
  customerPhone?: string;
  environmentSlug?: string;
  environmentName?: string;
  pagePath?: string;
  referrer?: string;
  itemCount?: number;
  estimatedTotal?: number;
  currency?: string;
  whatsappMessage?: string;
  whatsappUrl?: string;
  items?: InquiryItemPayload[];
  metadata?: Record<string, unknown>;
}

export interface InquiryListFilters {
  eventType?: string;
  environmentSlug?: string;
  from?: Date;
  to?: Date;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function formatInquiryEventLabel(eventType: string): string {
  const labels: Record<string, string> = {
    ADD_TO_CART: "Added to cart",
    REMOVE_FROM_CART: "Removed from cart",
    CART_CHECKOUT: "Cart checkout (WhatsApp)",
    PRODUCT_WHATSAPP: "Product WhatsApp",
    CATALOG_PRODUCT: "Catalog link",
    MOBILE_ORDER_BAR: "Mobile order bar",
    STICKY_BAR: "Sticky bar order",
  };
  return labels[eventType] ?? eventType;
}
