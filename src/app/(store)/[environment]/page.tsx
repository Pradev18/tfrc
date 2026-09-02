import { notFound } from "next/navigation";
import { resolveEnvironment } from "@/services/environment.service";
import { getShopCategories } from "@/services/shop-category.service";
import { getWhatsAppSettings } from "@/lib/whatsapp";
import { EnvironmentHome } from "@/components/store/EnvironmentHome";
import { getSiteUrl } from "@/lib/site-config";
import prisma from "@/lib/db";
import { getCachedEnvironment } from "@/lib/catalog-cache";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ environment: string }>;
}

async function getBrands(environmentId: string, slug: string) {
  try {
    return await prisma.brand.findMany({
      where: {
        isActive: true,
        products: { some: { environmentId, status: "ACTIVE" } },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    });
  } catch (error) {
    console.error("[store] brands prisma failed:", error);
    return getCachedEnvironment(slug)?.brands ?? [];
  }
}

export default async function EnvironmentHomePage({ params }: PageProps) {
  const { environment: slug } = await params;
  const environment = await resolveEnvironment(slug);
  if (!environment) notFound();

  const [shopCategories, waSettings, brands] = await Promise.all([
    getShopCategories(slug),
    getWhatsAppSettings(),
    getBrands(environment.id, slug),
  ]);

  const waHref = `https://wa.me/${waSettings.phoneNumber}?text=${encodeURIComponent(waSettings.defaultGreeting)}`;

  return (
    <EnvironmentHome
      environment={environment}
      shopCategories={shopCategories}
      brands={brands}
      waHref={waHref}
      whatsappSettings={waSettings}
      siteUrl={getSiteUrl()}
    />
  );
}
