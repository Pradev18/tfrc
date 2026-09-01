"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { GsapReveal, GsapStagger } from "@/components/motion/GsapReveal";
import { ProductCard } from "@/components/public/ProductCard";
import { getEnvVisual } from "@/lib/env-visuals";
import type { ProductWithRelations } from "@/services/product.service";
import type { WhatsAppSettings } from "@/lib/whatsapp";

interface PremiumProductGridProps {
  products: ProductWithRelations[];
  environmentSlug: string;
  environmentName: string;
  whatsappSettings: WhatsAppSettings;
  siteUrl: string;
  title: string;
  subtitle?: string;
  viewAllHref: string;
}

export function PremiumProductGrid({
  products,
  environmentSlug,
  environmentName,
  whatsappSettings,
  siteUrl,
  title,
  subtitle = "Curated picks",
  viewAllHref,
}: PremiumProductGridProps) {
  const v = getEnvVisual(environmentSlug);

  return (
    <section className="store-section pb-12 pt-2 md:pb-16 md:pt-4">
      <div className="container-pawmart">
        <GsapReveal>
          <div className="mb-7 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: v.muted }}>
                {subtitle}
              </p>
              <h2 className="mt-1.5 font-display text-2xl font-medium md:text-3xl" style={{ color: v.heading }}>
                {title}
              </h2>
            </div>
            <Link
              href={viewAllHref}
              className="hidden items-center gap-1 rounded-full px-4 py-2 text-sm font-semibold transition-all hover:-translate-y-0.5 sm:inline-flex"
              style={{ color: v.ctaText, backgroundColor: v.cta }}
            >
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </GsapReveal>

        <GsapStagger className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              whatsappSettings={whatsappSettings}
              environmentSlug={environmentSlug}
              environmentName={environmentName}
              siteUrl={siteUrl}
            />
          ))}
        </GsapStagger>
      </div>
    </section>
  );
}
