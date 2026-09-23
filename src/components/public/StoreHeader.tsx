import { EnvironmentHeader } from "@/components/public/EnvironmentHeader";
import { getSiteUrl } from "@/lib/site-config";
import { getShopCategories } from "@/services/shop-category.service";
import { getCategoryHeroImage } from "@/lib/category-images";
import { getWhatsAppSettings } from "@/lib/whatsapp.server";
import { normalizeCatalogueImageSrc } from "@/lib/media-url";
import type { ParsedEnvironment } from "@/services/environment.service";
import { getActiveEnvironments } from "@/services/environment.service";

export async function StoreHeader({ environment }: { environment: ParsedEnvironment }) {
  const [shopCategories, waSettings, activeEnvironments] = await Promise.all([
    getShopCategories(environment.slug).catch(() => []),
    getWhatsAppSettings().catch(() =>
      import("@/lib/whatsapp").then((m) => m.DEFAULT_WHATSAPP_SETTINGS)
    ),
    getActiveEnvironments().catch(() => []),
  ]);

  const settings = await Promise.resolve(waSettings);
  const waHref = `https://wa.me/${settings.phoneNumber}?text=${encodeURIComponent(settings.defaultGreeting)}`;
  const siteUrl = getSiteUrl();
  const brandImage =
    normalizeCatalogueImageSrc(environment.logoUrl) ||
    getCategoryHeroImage(environment.slug) ||
    "";

  return (
    <EnvironmentHeader
      environment={environment}
      shopCategories={shopCategories}
      brandImage={brandImage}
      waHref={waHref}
      whatsappSettings={settings}
      siteUrl={siteUrl}
      activeEnvironments={activeEnvironments.map((item) => ({
        slug: item.slug,
        displayName: item.config.displayName,
      }))}
    />
  );
}
