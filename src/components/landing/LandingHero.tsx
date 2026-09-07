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
      className="landing-portal-card group landing-fade-up flex w-32 flex-col items-center sm:w-36"
      style={{ animationDelay: `${index * 0.07}s` }}
      aria-label={portal.displayName}
    >
      <div
        className="catalogue-logo catalogue-logo--landing relative h-28 w-28 sm:h-32 sm:w-32"
        data-catalogue={portal.slug}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={portal.displayName}
            className="catalogue-logo__img"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-3xl font-medium text-[#141414]/20">
            {portal.displayName.charAt(0)}
          </div>
        )}
      </div>
      <span className="mt-3 w-full truncate text-center text-sm font-semibold text-[#292522] sm:text-[15px]">
        {portal.displayName}
      </span>
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
          <div className="flex justify-center">
            <TfrcBrand
              className="gap-3"
              iconClassName="h-6 md:h-7"
              textClassName="text-2xl md:text-3xl"
            />
          </div>
          <p className="mt-2 text-sm text-[#6b6560]">
            Choose your world — browse freely, order on WhatsApp
          </p>
        </div>

        <div id="catalogues" className="landing-portal-grid mx-auto mt-8 md:mt-10">
          {portals.map((portal, i) => (
            <CataloguePortalCard key={portal.slug} portal={portal} index={i} />
          ))}
        </div>

        <div className="mt-8 flex justify-center landing-fade-up landing-fade-delay-1 md:mt-10">
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="glass-btn inline-flex items-center gap-2 rounded-full border border-[#128c47]/20 bg-[#128c47]/90 px-4 py-2 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#0f7340]"
          >
            <WhatsAppIcon className="h-4 w-4" />
            Order on WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}
