import { formatCurrency } from "@/lib/utils";
import { getEffectivePrice } from "@/lib/pricing";
import { buildWhatsAppCatalogProductUrl } from "@/lib/whatsapp-catalog";
import { calculateLineTotal, calculateOrderTotal } from "@/lib/money";

export interface WhatsAppProductInput {
  name: string;
  productId: string;
  regularPrice: number;
  salePrice?: number | null;
  currency?: string;
  slug: string;
  imageUrl?: string;
  environmentSlug?: string;
  environmentName?: string;
  quantity?: number;
  size?: string;
}

export interface CartWhatsAppItem extends WhatsAppProductInput {
  displayPrice: number;
}

export interface WhatsAppSettings {
  phoneNumber: string;
  defaultGreeting: string;
  orderIntro?: string;
  productTemplate: string;
  closingMessage?: string;
}

export const DEFAULT_WHATSAPP_SETTINGS: WhatsAppSettings = {
  phoneNumber: "97455049229",
  defaultGreeting: "Hello TFRC team,",
  orderIntro: "I'd like to place the following order:",
  productTemplate:
    "{{index}}. {{name}}\n   Ref: {{productId}} | Qty: {{quantity}}\n   {{sizeLine}}{{lineTotal}}",
  closingMessage: "Please confirm availability and delivery details. Thank you.",
};

export function interpolateTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

/** Strip broken replacement chars from greetings copied across encodings */
function cleanGreeting(greeting: string): string {
  return greeting.replace(/\uFFFD/g, "").trim();
}

function cleanProductName(name: string, productId: string): string {
  const escapedId = productId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return name.replace(new RegExp(`(?:\\s+${escapedId})+$`, "i"), "").trim();
}

function buildProductPageUrl(
  item: Pick<WhatsAppProductInput, "slug" | "environmentSlug">,
  siteUrl?: string
): string {
  if (!siteUrl?.trim()) return "";
  const base = siteUrl.replace(/\/$/, "");
  const envPrefix = item.environmentSlug ? `/${item.environmentSlug}` : "";
  return `${base}${envPrefix}/product/${item.slug}`;
}

function formatOrderItemLine(
  settings: WhatsAppSettings,
  index: number,
  item: CartWhatsAppItem,
  siteUrl?: string
): string {
  const qty = Math.max(1, item.quantity ?? 1);
  const lineTotal = calculateLineTotal(item.displayPrice, qty);
  const priceStr = formatCurrency(lineTotal, item.currency ?? "QAR");
  const unitStr =
    qty > 1
      ? `${formatCurrency(item.displayPrice, item.currency ?? "QAR")} × ${qty}`
      : formatCurrency(item.displayPrice, item.currency ?? "QAR");
  const link = buildProductPageUrl(item, siteUrl);
  const template = settings.productTemplate.trim() || DEFAULT_WHATSAPP_SETTINGS.productTemplate;
  let formatted = interpolateTemplate(template, {
    index: String(index),
    name: cleanProductName(item.name, item.productId),
    price: qty > 1 ? `${unitStr} = ${priceStr}` : priceStr,
    unitPrice: formatCurrency(item.displayPrice, item.currency ?? "QAR"),
    lineTotal: priceStr,
    productId: item.productId,
    link,
    quantity: String(qty),
    catalogue: item.environmentName ? ` — ${item.environmentName}` : "",
    environmentName: item.environmentName ?? "",
    size: item.size ?? "",
    sizeLine: item.size ? `Size: ${item.size}\n   ` : "",
  });
  if (item.size && !template.includes("{{size}}")) {
    const lines = formatted.split("\n");
    lines.splice(1, 0, `   Size: ${item.size}`);
    formatted = lines.join("\n");
  }
  return formatted
    .split("\n")
    .filter((line) => !/^\s*(?:link|catalogue|size):\s*$/i.test(line))
    .join("\n")
    .trim();
}

export function buildWhatsAppMessage(
  settings: WhatsAppSettings,
  product: WhatsAppProductInput,
  siteUrl?: string
): string {
  const price = getEffectivePrice({
    regular: product.regularPrice,
    sale: product.salePrice,
    currency: product.currency ?? "QAR",
  });

  const body = formatOrderItemLine(
    settings,
    1,
    {
      ...product,
      displayPrice: price.displayPrice,
      quantity: Math.max(1, product.quantity ?? 1),
    },
    siteUrl
  );
  const quantity = Math.max(1, product.quantity ?? 1);
  const templateVars = {
    itemCount: String(quantity),
    total: formatCurrency(
      calculateLineTotal(price.displayPrice, quantity),
      product.currency ?? "QAR"
    ),
  };

  return [
    cleanGreeting(settings.defaultGreeting),
    "",
    interpolateTemplate(
      settings.orderIntro?.trim() || DEFAULT_WHATSAPP_SETTINGS.orderIntro!,
      templateVars
    ),
    "",
    body,
    "",
    interpolateTemplate(
      settings.closingMessage?.trim() || DEFAULT_WHATSAPP_SETTINGS.closingMessage!,
      templateVars
    ),
  ].join("\n");
}

export function buildCartWhatsAppMessage(
  settings: WhatsAppSettings,
  items: CartWhatsAppItem[],
  siteUrl?: string
): string {
  if (items.length === 0) return cleanGreeting(settings.defaultGreeting);

  const lines = items.map((item, index) =>
    formatOrderItemLine(settings, index + 1, item, siteUrl)
  );
  const total = calculateOrderTotal(
    items.map((item) => ({
      price: item.displayPrice,
      quantity: item.quantity,
    }))
  );
  const currency = items[0]?.currency ?? "QAR";
  const totalUnits = items.reduce((sum, i) => sum + Math.max(1, i.quantity ?? 1), 0);

  const templateVars = {
    itemCount: String(totalUnits),
    total: formatCurrency(total, currency),
  };
  const intro = interpolateTemplate(
    settings.orderIntro?.trim() || DEFAULT_WHATSAPP_SETTINGS.orderIntro!,
    templateVars
  );
  const closing = interpolateTemplate(
    settings.closingMessage?.trim() || DEFAULT_WHATSAPP_SETTINGS.closingMessage!,
    templateVars
  );

  return [
    cleanGreeting(settings.defaultGreeting),
    "",
    intro,
    "",
    lines.join("\n\n"),
    "",
    `Total: ${formatCurrency(total, currency)}`,
    "",
    closing,
  ].join("\n");
}

function cleanWhatsAppPhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Cart checkout URL — pre-filled order message with product links
 */
export function buildCartWhatsAppCheckoutUrl(
  settings: WhatsAppSettings,
  items: CartWhatsAppItem[],
  siteUrl?: string
): string {
  if (items.length === 0) {
    return buildWhatsAppUrl(settings.phoneNumber, settings.defaultGreeting);
  }

  const phone = cleanWhatsAppPhone(settings.phoneNumber);
  const message = buildCartWhatsAppMessage(settings, items, siteUrl);
  return buildWhatsAppUrl(phone, message);
}

export function buildCartWhatsAppUrl(
  settings: WhatsAppSettings,
  items: CartWhatsAppItem[],
  siteUrl?: string
): string {
  return buildCartWhatsAppCheckoutUrl(settings, items, siteUrl);
}

export function buildWhatsAppUrl(phoneNumber: string, message: string): string {
  const cleanPhone = phoneNumber.replace(/\D/g, "");
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

export function buildProductWhatsAppCatalogUrl(
  settings: WhatsAppSettings,
  product: WhatsAppProductInput
): string {
  return buildWhatsAppCatalogProductUrl(
    cleanWhatsAppPhone(settings.phoneNumber),
    product.productId
  );
}

export function generateWhatsAppCatalogLinkSync(
  settings: WhatsAppSettings,
  product: WhatsAppProductInput
): string {
  return buildProductWhatsAppCatalogUrl(settings, product);
}

export function generateWhatsAppLinkSync(
  settings: WhatsAppSettings,
  product: WhatsAppProductInput,
  siteUrl?: string
): string {
  const message = buildWhatsAppMessage(settings, product, siteUrl);
  return buildWhatsAppUrl(settings.phoneNumber, message);
}

export function extractPhoneFromWaLink(link: string): string | null {
  const match = link.match(/wa\.me\/(\d+)/);
  return match ? match[1] : null;
}
