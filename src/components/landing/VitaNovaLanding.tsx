"use client";

import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingHero } from "@/components/landing/LandingHero";
import { EnvironmentPortalCard } from "@/components/landing/EnvironmentPortalCard";
import { ENVIRONMENT_CONFIGS, PLATFORM } from "@/lib/environments";

interface VitaNovaLandingProps {
  waHref: string;
}

export function VitaNovaLanding({ waHref }: VitaNovaLandingProps) {
  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <div className="relative">
        <div className="absolute inset-x-0 top-0 z-50">
          <LandingHeader />
        </div>

        <LandingHero waHref={waHref} />
      </div>

      <section id="catalogues" className="relative py-16 md:py-24">
        <div className="container-pawmart">
          <div className="mb-12 max-w-2xl md:mb-14">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#9c9690]">
              Three worlds, one platform
            </p>
            <h2 className="mt-2 font-display text-3xl font-medium text-[#141414] md:text-4xl">
              Step into your catalogue
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-[#6b6560]">
              Each collection has its own look, categories, and shopping experience — pick the
              world that fits what you&apos;re shopping for.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3 md:gap-6">
            {ENVIRONMENT_CONFIGS.map((env, i) => (
              <div
                key={env.slug}
                className="landing-fade-up"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <EnvironmentPortalCard env={env} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#ebe8e3]/80 py-12">
        <div className="container-pawmart grid gap-6 md:grid-cols-3">
          {[
            { t: "Three curated worlds", d: "Pets, pro tools, and kitchen — each with its own store." },
            { t: "Real product photos", d: "Original catalogue images on every item." },
            { t: "WhatsApp checkout", d: "One tap to send your full order." },
          ].map((item) => (
            <div key={item.t} className="glass-panel p-6 text-center md:text-left">
              <h3 className="font-semibold text-[#141414]">{item.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#6b6560]">{item.d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="bg-[#141414] py-10 text-center">
        <p className="font-display text-lg text-white/90">{PLATFORM.fullName}</p>
        <p className="mt-2 text-xs text-white/40">
          © {new Date().getFullYear()} · Qatar · Order on WhatsApp
        </p>
      </footer>
    </div>
  );
}
