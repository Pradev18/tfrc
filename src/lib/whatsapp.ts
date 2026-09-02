import prisma from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { getEffectivePrice } from "@/lib/pricing";
import { getSiteUrl } from "@/lib/site-config";
import { buildWhatsAppCatalogProductUrl } from "@/lib/whatsapp-catalog";

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
}

export interface CartWhatsAppItem extends WhatsAppProductInput {
  displayPrice: number;
}

export interface WhatsAppSettings {
  phoneNumber: string;
  defaultGreeting: string;
  productTemplate: string;
}

const DEFAULT_SETTINGS: WhatsAppSettings = {
  phoneNumber: "97455049229",
  defaultGreeting: "Hello, I would like to order from TFRC Vita Nova",
  productTemplate: "{{name}} — {{price}} (Ref: {{productId}})",
};

export async function getWhatsAppSettings(): Promise<WhatsAppSettings> {
  try {
    const setting = await prisma.whatsAppSetting.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
    });

    if (!setting) return DEFAULT_SETTINGS;

    return {
      phoneNumber: setting.phoneNumber.replace(/\D/g, ""),
      defaultGreeting: setting.defaultGreeting,
      productTemplate: setting.productTemplate,
    };
  } catch (error) {
    console.error("[whatsapp] settings prisma failed:", error);
    return DEFAULT_SETTINGS;
  }
}

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
  index: number,
  item: CartWhatsAppItem,
  siteUrl?: string
): string {
  const priceStr = formatCurrency(item.displayPrice, item.currency ?? "QAR");
  const catalogue = item.environmentName ? ` — ${item.environmentName}` : "";
  const lines = [
    `${index}. ${item.name}${catalogue}`,
    `   Price: ${priceStr}`,
    `   Ref: ${item.productId}`,
  ];
  const link = buildProductPageUrl(item, siteUrl);
  if (link) lines.push(`   Link: ${link}`);
  return lines.join("\n");
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

  const priceStr = formatCurrency(price.displayPrice, price.currency);
  const link = buildProductPageUrl(product, siteUrl);
  const catalogue = product.environmentName ? `\nCatalogue: ${product.environmentName}` : "";

  const body = [
    `Product: ${product.name}${catalogue}`,
    `Price: ${priceStr}`,
    `Ref: ${product.productId}`,
  ];
  if (link) body.push(`Link: ${link}`);

  return [
    cleanGreeting(settings.defaultGreeting),
    "",
    "I would like to order this item from your website:",
    "",
    ...body,
    "",
    "Please confirm availability, price, and delivery in Qatar.",
    "",
    "Thank you!",
  ].join("\n");
}

export function buildCartWhatsAppMessage(
  settings: WhatsAppSettings,
  items: CartWhatsAppItem[],
  siteUrl?: string
): string {
  if (items.length === 0) return cleanGreeting(settings.defaultGreeting);

  const lines = items.map((item, index) => formatOrderItemLine(index + 1, item, siteUrl));
  const total = items.reduce((sum, i) => sum + i.displayPrice, 0);
  const currency = items[0]?.currency ?? "QAR";

  const intro =
    items.length === 1
      ? "I would like to order the following item from your website:"
      : `I would like to order ${items.length} items from your website:`;

  const closing =
    items.length === 1
      ? "Please confirm availability, price, and delivery in Qatar."
      : "Please confirm all items are available, the total price, and delivery in Qatar.";

  return [
    cleanGreeting(settings.defaultGreeting),
    "",
    intro,
    "",
    ...lines,
    "",
    `Order total: ${formatCurrency(total, currency)}`,
    "",
    closing,
    "",
    "Thank you!",
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

export async function generateWhatsAppLink(
  product: WhatsAppProductInput
): Promise<string> {
  const settings = await getWhatsAppSettings();
  const message = buildWhatsAppMessage(settings, product, getSiteUrl());
  return buildWhatsAppUrl(settings.phoneNumber, message);
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
