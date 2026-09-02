import { getNavCategories } from "@/services/category.service";
import { getWhatsAppSettings } from "@/lib/whatsapp.server";
import { SiteHeader } from "@/components/public/SiteHeader";

export async function Header() {
  const [categories, waSettings] = await Promise.all([
    getNavCategories(),
    getWhatsAppSettings(),
  ]);

  const waHref = `https://wa.me/${waSettings.phoneNumber}?text=${encodeURIComponent(waSettings.defaultGreeting)}`;

  return <SiteHeader categories={categories} waHref={waHref} />;
}
