"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import type { EnvironmentConfig } from "@/lib/environments";
import { getEnvVisual, envStyle } from "@/lib/env-visuals";
import { getCategoryHeroImage } from "@/lib/category-images";
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
    <section className="store-section relative overflow-hidden pt-3 md:pt-4" style={envStyle(v)}>
      <div className="container-pawmart">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
          <div className="min-w-0 flex-1 text-center sm:max-w-xl sm:text-left">
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.22em]"
              style={{ color: v.accent }}
            >
              {config.displayName} · Qatar
            </p>

            <h1
              className="mt-1.5 font-display text-xl font-medium leading-tight tracking-tight sm:text-2xl md:text-[1.75rem]"
              style={{ color: v.heading }}
            >
              {headline}
            </h1>

            <p className="mt-1.5 line-clamp-2 text-sm leading-snug" style={{ color: v.body }}>
              {config.description}
            </p>

            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              <Link
                href={`/${slug}#catalog`}
                className="glass-btn inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white transition-all hover:-translate-y-0.5"
                style={{ backgroundColor: v.cta, boxShadow: `0 6px 18px ${v.glow}` }}
              >
                Shop all
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="glass-btn inline-flex items-center gap-1.5 rounded-full border border-[#128c47]/25 bg-[#128c47]/10 px-4 py-2 text-xs font-semibold text-[#0f7340] transition-all hover:-translate-y-0.5 hover:bg-[#128c47]/15"
              >
                <WhatsAppIcon className="h-3.5 w-3.5" />
                WhatsApp
              </a>
            </div>
          </div>

          {brandImage ? (
            <div className="catalogue-logo shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={brandImage}
                alt={`${config.displayName} Qatar`}
                className="catalogue-logo__img h-[7.5rem] w-[7.5rem] sm:h-[8.5rem] sm:w-[8.5rem] md:h-[9.5rem] md:w-[9.5rem]"
              />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
