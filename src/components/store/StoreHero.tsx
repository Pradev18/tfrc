"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import type { EnvironmentConfig } from "@/lib/environments";
import { getEnvVisual, envStyle } from "@/lib/env-visuals";
import { getCategoryHeroImage } from "@/lib/category-images";
import { EnvBrandBadge } from "@/components/landing/EnvBrandBadge";
import { normalizeCatalogueImageSrc } from "@/lib/media-url";

interface StoreHeroProps {
  config: EnvironmentConfig;
  slug: string;
  waHref: string;
  logoUrl?: string | null;
}

export function StoreHero({ config, slug, waHref, logoUrl }: StoreHeroProps) {
  const v = getEnvVisual(slug);
  const headline = config.heroHeadline ?? config.tagline;
  const brandImage =
    normalizeCatalogueImageSrc(logoUrl) || getCategoryHeroImage(slug) || "";

  return (
    <section className="store-section relative overflow-hidden pt-4 md:pt-6" style={envStyle(v)}>
      <div className="container-pawmart">
        <div className="glass-panel-elevated overflow-hidden rounded-2xl p-5 sm:rounded-3xl sm:p-6 md:p-10 lg:p-12">
          <div className="grid items-center gap-6 sm:gap-8 lg:grid-cols-[1fr_min(420px,42%)] lg:gap-12">
            <div className="max-w-xl">
              <p
                className="text-xs font-semibold uppercase tracking-[0.2em]"
                style={{ color: v.accent }}
              >
                {config.displayName} · Qatar
              </p>

              <h1
                className="mt-3 font-display text-2xl font-medium leading-[1.12] tracking-tight sm:mt-4 sm:text-3xl md:text-4xl lg:text-[2.75rem]"
                style={{ color: v.heading }}
              >
                {headline}
              </h1>

              <p className="mt-4 text-base leading-relaxed md:text-lg" style={{ color: v.body }}>
                {config.description}
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={`/${slug}#catalog`}
                  className="glass-btn inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5"
                  style={{ backgroundColor: v.cta, boxShadow: `0 8px 24px ${v.glow}` }}
                >
                  Shop all products
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glass-btn inline-flex items-center gap-2 rounded-full border border-[#128c47]/25 bg-[#128c47]/10 px-6 py-3 text-sm font-semibold text-[#0f7340] transition-all hover:-translate-y-0.5 hover:bg-[#128c47]/15"
                >
                  <WhatsAppIcon className="h-4 w-4" />
                  Order on WhatsApp
                </a>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[280px] sm:max-w-[340px] lg:max-w-[380px]">
              {brandImage ? (
                <EnvBrandBadge
                  src={brandImage}
                  alt={`${config.displayName} Qatar`}
                  className="aspect-square min-h-[200px] rounded-2xl sm:min-h-[260px] md:min-h-[340px]"
                  sizes="(max-width: 768px) 80vw, 380px"
                  priority
                />
              ) : (
                <div className="flex min-h-[260px] items-center justify-center rounded-2xl bg-white md:min-h-[340px]" />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
