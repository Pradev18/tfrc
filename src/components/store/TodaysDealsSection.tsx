"use client";

import Link from "next/link";
import { ArrowRight, Flame } from "lucide-react";
import { GsapReveal, GsapStagger } from "@/components/motion/GsapReveal";
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

  const slug = environmentSlug ?? products[0]?.environment?.slug ?? "";
  if (!slug) return null;
  const v = getEnvVisual(slug);

  const saleLink =
    viewAllHref ??
    `/${slug}#catalog?q=deals`;

  const resolveEnv = (product: ProductWithRelations) => ({
    slug: environmentSlug ?? product.environment?.slug ?? slug,
    name: environmentName ?? product.environment?.name ?? "Shop",
  });

  return (
    <section className="store-section py-10 md:py-14">
      <div className="container-pawmart">
        <GsapReveal>
          <div className="glass-panel mb-7 flex flex-wrap items-end justify-between gap-4 rounded-2xl p-5 md:p-6">
            <div>
              <div className="flex items-center gap-2.5">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full text-white shadow-md"
                  style={{ backgroundColor: v.accent }}
                >
                  <Flame className="h-4 w-4" />
                </span>
                <h2 className="font-display text-2xl font-medium md:text-3xl" style={{ color: v.heading }}>
                  {title}
                </h2>
              </div>
              <p className="mt-2 text-sm" style={{ color: v.muted }}>
                {formatTodaysDealDate()} · Hand-picked discounts · Refreshes daily
              </p>
            </div>
            <Link
              href={saleLink}
              className="glass-btn inline-flex items-center gap-1 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5"
              style={{ backgroundColor: v.cta, boxShadow: `0 6px 20px ${v.glow}` }}
            >
              View all deals <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </GsapReveal>

        <GsapStagger className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
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
        </GsapStagger>
      </div>
    </section>
  );
}
