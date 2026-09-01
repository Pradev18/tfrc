import Link from "next/link";
import Image from "next/image";
import { MessageCircle, Sparkles } from "lucide-react";
import { GlassButton } from "@/components/ui/GlassButton";
import { PLATFORM } from "@/lib/environments";
import { LANDING_SHOWCASE, PLATFORM_HERO_IMAGE } from "@/lib/platform-images";
import { cn } from "@/lib/utils";

interface LandingHeroProps {
  waHref: string;
}

export function LandingHero({ waHref }: LandingHeroProps) {
  return (
    <section className="landing-hero relative overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src={PLATFORM_HERO_IMAGE}
          alt=""
          fill
          className="object-cover"
          sizes="100vw"
          priority
          quality={90}
        />
        <div className="landing-hero-overlay absolute inset-0" />
      </div>

      <div className="container-pawmart relative z-10 px-6 pb-16 pt-28 md:px-10 md:pb-24 md:pt-32 lg:pb-28 lg:pt-36">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="glass-panel landing-fade-up p-8 md:p-10">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#b8956b]" strokeWidth={1.5} />
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#6b6560]">
                Qatar · Premium catalogues · WhatsApp
              </p>
            </div>

            <h1 className="mt-5 font-display text-4xl font-medium leading-[1.05] text-[#141414] md:text-5xl lg:text-[3.25rem]">
              Curated shopping,
              <span className="mt-1 block text-[#6b6560]">delivered your way</span>
            </h1>

            <p className="mt-2 font-display text-xl text-[#9c9690] md:text-2xl">
              {PLATFORM.fullName}
            </p>

            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-[#6b6560]">
              Three distinct collections — pets, pro tools, and kitchen & home. Browse freely in
              each world, then order on WhatsApp in seconds.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <GlassButton href="#catalogues" variant="primary">
                Choose your catalogue
              </GlassButton>
              <GlassButton href={waHref} variant="whatsapp" external>
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </GlassButton>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-none landing-fade-up landing-fade-delay-1">
            <div className="glass-panel-elevated relative aspect-[4/5] overflow-hidden rounded-3xl p-3 md:aspect-square md:max-h-[520px]">
              <div className="grid h-full grid-cols-2 grid-rows-2 gap-2.5">
                {LANDING_SHOWCASE.map((item, i) => (
                  <Link
                    key={item.slug}
                    href={`/${item.slug}`}
                    className={cn(
                      "env-portal-tile env-brand-badge group relative overflow-hidden rounded-2xl",
                      i === 0 && "col-span-1 row-span-2"
                    )}
                  >
                    <div className="env-brand-badge-glow pointer-events-none absolute inset-0" aria-hidden />
                    <Image
                      src={item.image}
                      alt={item.label}
                      width={400}
                      height={400}
                      className="relative z-10 mx-auto h-full w-[82%] object-contain p-2 transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                      sizes="(max-width:768px) 50vw, 280px"
                    />
                  </Link>
                ))}
              </div>
            </div>
            <div className="glass-orb absolute -right-4 -top-4 h-24 w-24 rounded-full md:h-32 md:w-32" aria-hidden />
            <div className="glass-orb absolute -bottom-6 -left-6 h-20 w-20 rounded-full opacity-60 md:h-28 md:w-28" aria-hidden />
          </div>
        </div>
      </div>
    </section>
  );
}
