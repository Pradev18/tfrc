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
    <section className="store-section relative pt-3 pb-2 md:pt-4 md:pb-3" style={envStyle(v)}>
      <div className="container-pawmart">
        <div className="flex items-center justify-between gap-4 sm:gap-6">
          <div className="min-w-0 flex-1">
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.22em]"
              style={{ color: v.accent }}
            >
              {config.displayName} · Qatar
            </p>

            <h1
              className="mt-1 font-display text-lg font-medium leading-tight tracking-tight sm:text-xl md:text-2xl"
              style={{ color: v.heading }}
            >
              {headline}
            </h1>

            <p
              className="mt-1 hidden max-w-lg text-sm leading-snug sm:line-clamp-2 sm:block"
              style={{ color: v.body }}
            >
              {config.description}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`/${slug}#catalog`}
                className="glass-btn inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white transition-all hover:-translate-y-0.5"
                style={{ backgroundColor: v.cta, boxShadow: `0 6px 18px ${v.glow}` }}
              >
                Shop all
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="glass-btn inline-flex items-center gap-1.5 rounded-full border border-[#128c47]/25 bg-[#128c47]/10 px-3.5 py-1.5 text-xs font-semibold text-[#0f7340] transition-all hover:-translate-y-0.5 hover:bg-[#128c47]/15"
              >
                <WhatsAppIcon className="h-3.5 w-3.5" />
                WhatsApp
              </a>
            </div>
          </div>

          {brandImage ? (
            <div className="catalogue-logo h-20 w-20 shrink-0 sm:h-24 sm:w-24 md:h-28 md:w-28">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={brandImage}
                alt={`${config.displayName} Qatar`}
                className="catalogue-logo__img"
              />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
