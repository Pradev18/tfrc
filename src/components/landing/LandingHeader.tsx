"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, ShoppingBag, X } from "lucide-react";
import { TfrcBrand } from "@/components/brand/TfrcBrand";
import { getEnvVisual } from "@/lib/env-visuals";
import { EnvIcon } from "@/components/public/EnvIcon";
import { CartDrawer } from "@/components/public/CartDrawer";
import type { LandingPortal } from "@/lib/platform-images";
import type { WhatsAppSettings } from "@/lib/whatsapp";

interface LandingHeaderProps {
  portals: LandingPortal[];
  whatsappSettings: WhatsAppSettings;
  siteUrl?: string;
}

export function LandingHeader({ portals, whatsappSettings, siteUrl }: LandingHeaderProps) {
  const [catalogueOpen, setCatalogueOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setCatalogueOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className={`sticky top-0 z-50 transition-shadow duration-300 ${scrolled ? "glass-nav shadow-sm" : "bg-transparent"}`}
      >
        <div className="container-pawmart flex h-14 items-center justify-between sm:h-[4.25rem]">
          <Link href="/" className="group transition-opacity hover:opacity-85">
            <TfrcBrand />
          </Link>

          <nav className="flex items-center gap-1 sm:gap-1.5" ref={menuRef}>
            <div className="relative hidden md:block">
              <button
                type="button"
                onClick={() => setCatalogueOpen(!catalogueOpen)}
                className="glass-btn flex min-h-[44px] items-center gap-1.5 rounded-full border border-white/60 bg-white/50 px-4 py-2.5 text-sm font-medium text-[#141414] backdrop-blur-md hover:bg-white/80"
              >
                Catalogues
                <ChevronDown
                  className={`h-3.5 w-3.5 text-[#9c9690] transition-transform duration-300 ${catalogueOpen ? "rotate-180" : ""}`}
                />
              </button>

              {catalogueOpen && (
                <div className="glass-panel animate-dropdown absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] p-2">
                  {portals.map((portal) => {
                    const v = getEnvVisual(portal.slug);
                    return (
                      <Link
                        key={portal.slug}
                        href={`/${portal.slug}`}
                        onClick={() => setCatalogueOpen(false)}
                        className="flex items-center gap-4 rounded-xl px-4 py-3.5 transition-colors hover:bg-white/50"
                      >
                        <span
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                          style={{ background: v.heroGradient ?? v.gradientAccent, color: v.heading }}
                        >
                          <EnvIcon slug={portal.slug} className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#141414]">{portal.displayName}</p>
                          <p className="mt-0.5 truncate text-xs text-[#6b6560]">{portal.tagline}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="glass-btn touch-target flex items-center justify-center rounded-full border border-white/60 bg-white/50 text-[#141414] backdrop-blur-md hover:bg-white/80 md:hidden"
              aria-label="Open catalogues menu"
            >
              <Menu className="h-5 w-5" strokeWidth={1.5} />
            </button>

            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="glass-btn touch-target flex items-center justify-center rounded-full border border-white/60 bg-white/50 text-[#141414] backdrop-blur-md hover:bg-white/80"
              aria-label="Open cart"
            >
              <ShoppingBag className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </nav>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 right-0 flex w-[min(100%,320px)] flex-col bg-[#faf9f7] shadow-xl">
            <div className="flex items-center justify-between border-b border-[#ebe8e3] p-4">
              <span className="font-display text-lg font-medium text-[#141414]">Catalogues</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="touch-target flex items-center justify-center rounded-full"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3">
              {portals.map((portal) => {
                const v = getEnvVisual(portal.slug);
                return (
                  <Link
                    key={portal.slug}
                    href={`/${portal.slug}`}
                    onClick={() => setMobileOpen(false)}
                    className="mb-1 flex items-center gap-3 rounded-xl px-3 py-3.5 transition-colors hover:bg-white/80"
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: v.heroGradient ?? v.gradientAccent, color: v.heading }}
                    >
                      <EnvIcon slug={portal.slug} className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#141414]">{portal.displayName}</p>
                      <p className="truncate text-xs text-[#6b6560]">{portal.tagline}</p>
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        whatsappSettings={whatsappSettings}
        siteUrl={siteUrl}
      />
    </>
  );
}
