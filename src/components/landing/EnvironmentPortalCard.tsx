import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { EnvironmentConfig } from "@/lib/environments";
import { getEnvVisual, envStyle } from "@/lib/env-visuals";
import { getCategoryHeroImage } from "@/lib/category-images";
import { EnvBrandBadge } from "@/components/landing/EnvBrandBadge";

interface EnvironmentPortalCardProps {
  env: EnvironmentConfig;
}

export function EnvironmentPortalCard({ env }: EnvironmentPortalCardProps) {
  const v = getEnvVisual(env.slug);
  const brandImage = getCategoryHeroImage(env.slug);

  return (
    <Link
      href={`/${env.slug}`}
      className="env-portal-card group flex h-full flex-col overflow-hidden rounded-2xl"
      style={{
        ...envStyle(v),
        background: v.heroGradient,
        boxShadow: v.cardShadow,
      }}
    >
      <div className="relative aspect-square overflow-hidden">
        {brandImage ? (
          <EnvBrandBadge
            src={brandImage}
            alt={`${env.displayName} Qatar`}
            className="h-full w-full"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        ) : (
          <div className="env-brand-badge h-full w-full bg-transparent" />
        )}

        <span
          className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition-transform duration-300 group-hover:scale-110"
          style={{ background: v.surface, color: v.cta }}
        >
          <ArrowUpRight className="h-4 w-4" strokeWidth={1.75} />
        </span>
      </div>

      <div
        className="flex flex-1 flex-col p-5 md:p-6"
        style={{ background: v.sectionAlt, borderTop: `1px solid ${v.border}` }}
      >
        <p className="flex-1 text-sm leading-relaxed" style={{ color: v.body }}>
          {env.description}
        </p>

        <span
          className="mt-5 inline-flex w-fit items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-300 group-hover:gap-3"
          style={{
            background: v.cta,
            color: v.ctaText,
            boxShadow: `0 4px 16px ${v.glow}`,
          }}
        >
          {env.ctaLabel}
          <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </div>
    </Link>
  );
}
