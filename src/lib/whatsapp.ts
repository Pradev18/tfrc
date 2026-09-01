import prisma from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { getEffectivePrice } from "@/lib/pricing";
import { getSiteUrl } from "@/lib/site-config";

export interface WhatsAppProductInput {
  name: string;
  productId: string;
  regularPrice: number;
  salePrice?: number | null;
  currency?: string;
  slug: string;
  imageUrl?: string;
  environmentSlug?: string;
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
  productTemplate:
    "• {{name}}\n  Price: {{price}}\n  Ref: {{productId}}",
};

export async function getWhatsAppSettings(): Promise<WhatsAppSettings> {
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
}

export function interpolateTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
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

  const envPrefix = product.environmentSlug ? `/${product.environmentSlug}` : "";
  const productUrl = siteUrl ? `${siteUrl}${envPrefix}/product/${product.slug}` : "";

  const productLine = interpolateTemplate(settings.productTemplate, {
    name: product.name,
    productId: product.productId,
    price: formatCurrency(price.displayPrice, price.currency),
    url: productUrl,
  });

  let message = `${settings.defaultGreeting}:\n\n${productLine}`;
  if (productUrl) message += `\n  Link: ${productUrl}`;
  message += "\n\nPlease confirm availability and delivery in Qatar. Thank you!";
  return message.trim();
}

export function buildCartWhatsAppMessage(
  settings: WhatsAppSettings,
  items: CartWhatsAppItem[],
  siteUrl?: string
): string {
  if (items.length === 0) return settings.defaultGreeting;

  const lines = items.map((item, index) => {
    const envPrefix = item.environmentSlug ? `/${item.environmentSlug}` : "";
    const productUrl = siteUrl ? `${siteUrl}${envPrefix}/product/${item.slug}` : "";
    const priceStr = formatCurrency(item.displayPrice, item.currency ?? "QAR");
    let line = `${index + 1}. ${item.name}\n   Price: ${priceStr}\n   Ref: ${item.productId}`;
    if (productUrl) line += `\n   Link: ${productUrl}`;
    if (item.imageUrl) line += `\n   Image: ${item.imageUrl}`;
    return line;
  });

  const total = items.reduce((sum, i) => sum + i.displayPrice, 0);
  const currency = items[0]?.currency ?? "QAR";

  return [
    settings.defaultGreeting + ":",
    "",
    ...lines,
    "",
    `Estimated total: ${formatCurrency(total, currency)}`,
    "",
    "Please confirm availability and delivery in Qatar. Thank you!",
  ].join("\n");
}

export function buildCartWhatsAppUrl(
  settings: WhatsAppSettings,
  items: CartWhatsAppItem[],
  siteUrl?: string
): string {
  const message = buildCartWhatsAppMessage(settings, items, siteUrl);
  return buildWhatsAppUrl(settings.phoneNumber, message);
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
