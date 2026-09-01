import { EnvironmentHeader } from "@/components/public/EnvironmentHeader";
import { getShopCategories } from "@/services/shop-category.service";
import { getCategoryHeroImage } from "@/lib/category-images";
import { getWhatsAppSettings } from "@/lib/whatsapp";
import type { ParsedEnvironment } from "@/services/environment.service";

export async function StoreHeader({ environment }: { environment: ParsedEnvironment }) {
  const [shopCategories, waSettings] = await Promise.all([
    getShopCategories(environment.slug),
    getWhatsAppSettings(),
  ]);

  const waHref = `https://wa.me/${waSettings.phoneNumber}?text=${encodeURIComponent(waSettings.defaultGreeting)}`;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const brandImage = getCategoryHeroImage(environment.slug);

  return (
    <EnvironmentHeader
      environment={environment}
      shopCategories={shopCategories}
      brandImage={brandImage}
      waHref={waHref}
      whatsappSettings={waSettings}
      siteUrl={siteUrl}
    />
  );
}
