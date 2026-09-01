import Link from "next/link";
import { MessageCircle, ArrowRight } from "lucide-react";
import type { EnvironmentConfig } from "@/lib/environments";
import { getEnvVisual, envStyle } from "@/lib/env-visuals";
import { getCategoryHeroImage } from "@/lib/category-images";
import { EnvBrandBadge } from "@/components/landing/EnvBrandBadge";

interface StoreHeroProps {
  config: EnvironmentConfig;
  slug: string;
  waHref: string;
}

export function StoreHero({ config, slug, waHref }: StoreHeroProps) {
  const v = getEnvVisual(slug);
  const headline = config.heroHeadline ?? config.tagline;
  const brandImage = getCategoryHeroImage(slug);

  return (
    <section
      className="relative overflow-hidden border-b"
      style={{
        ...envStyle(v),
        backgroundColor: v.surface,
        borderColor: v.border,
      }}
    >
      <div className="container-pawmart py-8 md:py-12">
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
          <div className="max-w-xl">
            <div className="flex items-center gap-3">
              <span
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ backgroundColor: v.badgeBg, color: v.heading }}
              >
                <span className="text-sm font-bold" style={{ color: v.accent }}>
                  {config.displayName.charAt(0)}
                </span>
              </span>
              <span className="text-sm font-semibold" style={{ color: v.accent }}>
                {config.displayName} · Qatar
              </span>
            </div>

            <h1
              className="mt-5 text-3xl font-bold leading-tight tracking-tight md:text-4xl lg:text-5xl"
              style={{ color: v.heading }}
            >
              {headline}
            </h1>

            <p className="mt-4 text-base leading-relaxed md:text-lg" style={{ color: v.body }}>
              {config.description}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={`/${slug}/catalogue`}
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:opacity-95"
                style={{ backgroundColor: v.cta, boxShadow: `0 4px 16px ${v.glow}` }}
              >
                Shop all products
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-semibold transition-all hover:-translate-y-0.5 hover:bg-[#faf9f7]"
                style={{ borderColor: v.border, color: v.heading }}
              >
                <MessageCircle className="h-4 w-4 text-[#128c47]" />
                Order on WhatsApp
              </a>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl">
            {brandImage ? (
              <EnvBrandBadge
                src={brandImage}
                alt={`${config.displayName} Qatar`}
                className="aspect-square min-h-[280px] md:min-h-[380px]"
                imageClassName="w-[72%] max-w-[320px]"
                sizes="(max-width: 768px) 90vw, 420px"
              />
            ) : (
              <div
                className="env-brand-badge flex min-h-[280px] items-center justify-center md:min-h-[380px]"
                style={{ background: v.gradientAccent }}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
