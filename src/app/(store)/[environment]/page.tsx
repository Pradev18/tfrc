import { notFound } from "next/navigation";
import { resolveEnvironment } from "@/services/environment.service";
import { getFeaturedProducts, getAllSaleProducts } from "@/services/product.service";
import { getShopCategories } from "@/services/shop-category.service";
import { getWhatsAppSettings } from "@/lib/whatsapp";
import { pickTodaysDeals } from "@/lib/todays-deals";
import { EnvironmentHome } from "@/components/store/EnvironmentHome";
import { getSiteUrl } from "@/lib/site-config";

interface PageProps {
  params: Promise<{ environment: string }>;
}

export default async function EnvironmentHomePage({ params }: PageProps) {
  const { environment: slug } = await params;
  const environment = await resolveEnvironment(slug);
  if (!environment) notFound();

  const [featured, allSale, shopCategories, waSettings] = await Promise.all([
    getFeaturedProducts(10, slug),
    getAllSaleProducts(slug),
    getShopCategories(slug),
    getWhatsAppSettings(),
  ]);

  const todaysDeals = pickTodaysDeals(allSale, 10);
  const saleProducts = allSale.slice(0, 12);

  const waHref = `https://wa.me/${waSettings.phoneNumber}?text=${encodeURIComponent(waSettings.defaultGreeting)}`;

  return (
    <EnvironmentHome
      environment={environment}
      featured={featured}
      saleProducts={saleProducts}
      todaysDeals={todaysDeals}
      shopCategories={shopCategories}
      waHref={waHref}
      whatsappSettings={waSettings}
      siteUrl={getSiteUrl()}
    />
  );
}
