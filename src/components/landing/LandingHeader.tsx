"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ShoppingBag } from "lucide-react";
import { ENVIRONMENT_CONFIGS, PLATFORM } from "@/lib/environments";
import { getEnvVisual } from "@/lib/env-visuals";
import { EnvIcon } from "@/components/public/EnvIcon";
import { CartDrawer } from "@/components/public/CartDrawer";

export function LandingHeader() {
  const [catalogueOpen, setCatalogueOpen] = useState(false);
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
        <div className="mx-auto flex h-[4.25rem] max-w-[90rem] items-center justify-between px-6 md:px-10">
          <Link href="/" className="group flex items-baseline gap-2.5">
            <span className="font-display text-[1.65rem] font-medium tracking-tight text-[#141414] transition-opacity group-hover:opacity-80">
              {PLATFORM.name}
            </span>
            <span className="hidden text-[10px] font-medium uppercase tracking-[0.32em] text-[#9c9690] sm:inline">
              {PLATFORM.tagline}
            </span>
          </Link>

          <nav className="flex items-center gap-1.5" ref={menuRef}>
            <div className="relative hidden sm:block">
              <button
                type="button"
                onClick={() => setCatalogueOpen(!catalogueOpen)}
                className="glass-btn flex items-center gap-1.5 rounded-full border border-white/60 bg-white/50 px-4 py-2.5 text-sm font-medium text-[#141414] backdrop-blur-md hover:bg-white/80"
              >
                Catalogues
                <ChevronDown
                  className={`h-3.5 w-3.5 text-[#9c9690] transition-transform duration-300 ${catalogueOpen ? "rotate-180" : ""}`}
                />
              </button>

              {catalogueOpen && (
                <div className="glass-panel animate-dropdown absolute right-0 top-full z-50 mt-2 w-[22rem] p-2">
                  {ENVIRONMENT_CONFIGS.map((env) => {
                    const v = getEnvVisual(env.slug);
                    return (
                      <Link
                        key={env.slug}
                        href={`/${env.slug}`}
                        onClick={() => setCatalogueOpen(false)}
                        className="flex items-center gap-4 rounded-xl px-4 py-3.5 transition-colors hover:bg-white/50"
                      >
                        <span
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                          style={{ background: v.heroGradient ?? v.gradientAccent, color: v.heading }}
                        >
                          <EnvIcon slug={env.slug} className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-[#141414]">{env.displayName}</p>
                          <p className="mt-0.5 text-xs text-[#6b6560]">{env.tagline}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="glass-btn flex h-10 w-10 items-center justify-center rounded-full border border-white/60 bg-white/50 text-[#141414] backdrop-blur-md hover:bg-white/80"
              aria-label="Open cart"
            >
              <ShoppingBag className="h-[1.1rem] w-[1.1rem]" strokeWidth={1.5} />
            </button>
          </nav>
        </div>
      </header>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
