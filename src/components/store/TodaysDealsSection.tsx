import Link from "next/link";
import { ArrowRight, Flame } from "lucide-react";
import { ProductCard } from "@/components/public/ProductCard";
import { formatTodaysDealDate } from "@/lib/todays-deals";
import { getEnvVisual } from "@/lib/env-visuals";
import type { ProductWithRelations } from "@/services/product.service";
import type { WhatsAppSettings } from "@/lib/whatsapp";

interface TodaysDealsSectionProps {
  products: ProductWithRelations[];
  whatsappSettings: WhatsAppSettings;
  siteUrl: string;
  environmentSlug?: string;
  environmentName?: string;
  title?: string;
  viewAllHref?: string;
}

export function TodaysDealsSection({
  products,
  whatsappSettings,
  siteUrl,
  environmentSlug,
  environmentName,
  title = "Today's Deals",
  viewAllHref,
}: TodaysDealsSectionProps) {
  if (products.length === 0) return null;

  const slug = environmentSlug ?? "pawmart";
  const v = getEnvVisual(slug);

  const saleLink =
    viewAllHref ??
    (environmentSlug ? `/${environmentSlug}/catalogue?sale=true&sort=discount` : "/pawmart/catalogue?sale=true&sort=discount");

  const resolveEnv = (product: ProductWithRelations) => ({
    slug: environmentSlug ?? product.environment?.slug ?? "pawmart",
    name: environmentName ?? product.environment?.name ?? "Shop",
  });

  return (
    <section
      className="store-section border-b py-10 md:py-12"
      style={{
        borderColor: v.border,
        background: `linear-gradient(180deg, ${v.badgeBg} 0%, ${v.surface} 100%)`,
      }}
    >
      <div className="container-pawmart">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#dc2626] text-white shadow-sm">
                <Flame className="h-4 w-4" />
              </span>
              <h2 className="font-display text-xl font-medium md:text-2xl" style={{ color: v.heading }}>
                {title}
              </h2>
            </div>
            <p className="mt-1 text-sm" style={{ color: v.muted }}>
              {formatTodaysDealDate()} · Hand-picked discounts · Refreshes daily
            </p>
          </div>
          <Link
            href={saleLink}
            className="inline-flex items-center gap-1 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:opacity-95"
            style={{ backgroundColor: "#dc2626", boxShadow: "0 4px 16px rgba(220,38,38,0.25)" }}
          >
            View all deals <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {products.slice(0, 10).map((product) => {
            const env = resolveEnv(product);
            return (
              <ProductCard
                key={product.id}
                product={product}
                whatsappSettings={whatsappSettings}
                environmentSlug={env.slug}
                environmentName={env.name}
                siteUrl={siteUrl}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
