import { notFound } from "next/navigation";
import { resolveEnvironment } from "@/services/environment.service";
import { getShopCategories } from "@/services/shop-category.service";
import { getWhatsAppSettings } from "@/lib/whatsapp";
import { EnvironmentHome } from "@/components/store/EnvironmentHome";
import { getSiteUrl } from "@/lib/site-config";
import prisma from "@/lib/db";

interface PageProps {
  params: Promise<{ environment: string }>;
}

export default async function EnvironmentHomePage({ params }: PageProps) {
  const { environment: slug } = await params;
  const environment = await resolveEnvironment(slug);
  if (!environment) notFound();

  const [shopCategories, waSettings, brands] = await Promise.all([
    getShopCategories(slug),
    getWhatsAppSettings(),
    prisma.brand.findMany({
      where: {
        isActive: true,
        products: { some: { environmentId: environment.id, status: "ACTIVE" } },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    }),
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
