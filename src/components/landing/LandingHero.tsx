import Link from "next/link";
import { TfrcBrand } from "@/components/brand/TfrcBrand";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { LANDING_PORTALS } from "@/lib/platform-images";
import type { LandingPortal } from "@/lib/platform-images";
import { normalizeCatalogueImageSrc } from "@/lib/media-url";

interface CataloguePortalCardProps {
  portal: LandingPortal;
  index: number;
}

export function CataloguePortalCard({ portal, index }: CataloguePortalCardProps) {
  const image = normalizeCatalogueImageSrc(portal.image);

  return (
    <Link
      href={`/${portal.slug}`}
      className="landing-portal-card group landing-fade-up w-full max-w-[8.5rem] sm:max-w-[10.5rem]"
      style={{ animationDelay: `${index * 0.07}s` }}
    >
      <div className="landing-portal-badge relative aspect-square overflow-hidden rounded-xl bg-transparent">
        {image ? (
          // Plain img always fills the badge; avoids next/image wrapper sizing quirks.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={portal.displayName}
            className="landing-portal-badge__img"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-transparent font-display text-4xl font-medium text-[#141414]/20">
            {portal.displayName.charAt(0)}
          </div>
        )}
      </div>
      <div className="mt-2.5 text-center">
        <p className="font-display text-[13px] font-medium text-[#141414] sm:text-sm">
          {portal.displayName}
        </p>
        <p className="mt-0.5 text-[11px] uppercase tracking-[0.1em] text-[#9c9690] sm:text-xs sm:tracking-[0.12em]">
          {portal.tagline}
        </p>
      </div>
    </Link>
  );
}

interface LandingHeroProps {
  waHref: string;
  portals?: LandingPortal[];
}

export function LandingHero({ waHref, portals = LANDING_PORTALS }: LandingHeroProps) {
  return (
    <section className="landing-hero relative flex w-full flex-1 items-center justify-center overflow-hidden">
      <div className="landing-hero-bg pointer-events-none absolute inset-0" aria-hidden />

      <div className="container-pawmart relative z-10 flex w-full flex-col items-center justify-center py-8 sm:py-10 md:py-12">
        <div className="mx-auto max-w-xl text-center landing-fade-up">
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[#9c9690]">
            Qatar · Premium catalogues
          </p>
          <div className="mt-3 flex justify-center">
            <TfrcBrand
              className="gap-3"
              iconClassName="h-6 md:h-7"
              textClassName="text-2xl md:text-3xl"
            />
          </div>
          <p className="mt-1.5 text-[13px] text-[#6b6560] md:text-sm">
            Choose your world — browse freely, order on WhatsApp
          </p>
        </div>

        <div id="catalogues" className="landing-portal-grid mx-auto mt-8 md:mt-9">
          {portals.map((portal, i) => (
            <CataloguePortalCard key={portal.slug} portal={portal} index={i} />
          ))}
        </div>

        <div className="mt-8 flex justify-center landing-fade-up landing-fade-delay-1 md:mt-9">
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="glass-btn inline-flex items-center gap-2 rounded-full border border-[#128c47]/20 bg-[#128c47]/90 px-4 py-2 text-[13px] font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#0f7340] md:text-sm"
          >
            <WhatsAppIcon className="h-4 w-4 md:h-[1.05rem] md:w-[1.05rem]" />
            Order on WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}
