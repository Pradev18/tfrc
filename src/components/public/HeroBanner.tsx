import Link from "next/link";
import Image from "next/image";
import { WhatsAppButton } from "@/components/public/WhatsAppButton";

interface HeroBannerProps {
  headline: string;
  subheadline: string;
  waHref: string;
  collageImages: string[];
  ctaHref?: string;
  ctaLabel?: string;
  eyebrow?: string;
}

export function HeroBanner({
  headline,
  subheadline,
  waHref,
  collageImages,
  ctaHref = "/catalogue",
  ctaLabel = "Explore Catalogue",
  eyebrow = "TFRC Vita Nova",
}: HeroBannerProps) {
  return (
    <section className="relative overflow-hidden border-b border-border bg-surface-muted">
      <div className="container-pawmart">
        <div className="grid items-center gap-8 py-12 md:grid-cols-2 md:gap-12 md:py-20 lg:py-24">
          {/* Copy */}
          <div className="animate-fade-in-up order-2 md:order-1">
            <p className="eyebrow">{eyebrow}</p>
            <h1 className="text-display mt-4 whitespace-pre-line text-[2.25rem] font-medium leading-[1.08] text-primary sm:text-5xl lg:text-[3.5rem]">
              {headline}
            </h1>
            <div className="section-rule" />
            <p className="mt-5 max-w-lg text-base leading-relaxed text-text-muted md:text-lg">
              {subheadline}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={ctaHref} prefetch className="btn-primary text-center">
                {ctaLabel}
              </Link>
              <WhatsAppButton href={waHref} label="Order on WhatsApp" />
            </div>
          </div>

          {/* Image collage */}
          <div className="animate-fade-in-up order-1 md:order-2 stagger-2">
            {collageImages.length >= 3 ? (
              <div className="grid grid-cols-12 grid-rows-6 gap-2 md:gap-3">
                <div className="relative col-span-7 row-span-4 overflow-hidden border border-border bg-surface">
                  <Image
                    src={collageImages[0]}
                    alt="Pet products"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 50vw, 30vw"
                    priority
                  />
                </div>
                <div className="relative col-span-5 row-span-3 overflow-hidden border border-border bg-surface">
                  <Image
                    src={collageImages[1]}
                    alt="Home products"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 40vw, 20vw"
                    priority
                  />
                </div>
                <div className="relative col-span-5 row-span-3 overflow-hidden border border-border bg-surface">
                  <Image
                    src={collageImages[2]}
                    alt="Tools"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 40vw, 20vw"
                    priority
                  />
                </div>
                <div className="col-span-7 row-span-2 flex items-center border border-border bg-primary px-5">
                  <p className="text-[11px] font-semibold uppercase leading-relaxed tracking-[0.15em] text-primary-foreground/90">
                    Curated for Qatar · Order on WhatsApp
                  </p>
                </div>
              </div>
            ) : (
              <div className="relative aspect-[4/3] overflow-hidden border border-border bg-primary/5">
                {collageImages[0] && (
                  <Image
                    src={collageImages[0]}
                    alt="PawMart catalogue"
                    fill
                    className="object-cover"
                    priority
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
