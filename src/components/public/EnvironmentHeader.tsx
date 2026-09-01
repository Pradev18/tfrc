"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Menu, X, Search, ChevronDown, ArrowRight } from "lucide-react";
import { WhatsAppButton } from "@/components/public/WhatsAppButton";
import { CartButton } from "@/components/public/CartButton";
import { CartDrawer } from "@/components/public/CartDrawer";
import { ENVIRONMENT_CONFIGS } from "@/lib/environments";
import { getEnvVisual } from "@/lib/env-visuals";
import { EnvIcon } from "@/components/public/EnvIcon";
import type { WhatsAppSettings } from "@/lib/whatsapp";
import type { ParsedEnvironment } from "@/services/environment.service";

interface ShopNavCategory {
  slug: string;
  name: string;
  productCount?: number;
}

interface EnvironmentHeaderProps {
  environment: ParsedEnvironment;
  shopCategories: ShopNavCategory[];
  brandImage?: string;
  waHref: string;
  whatsappSettings: WhatsAppSettings;
  siteUrl?: string;
}

export function EnvironmentHeader({
  environment,
  shopCategories,
  brandImage,
  waHref,
  whatsappSettings,
  siteUrl,
}: EnvironmentHeaderProps) {
  const router = useRouter();
  const envSlug = environment.slug;
  const v = getEnvVisual(envSlug);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [catalogueOpen, setCatalogueOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = mobileOpen || searchOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen, searchOpen]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setCategoriesOpen(false);
        setCatalogueOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    setSearchOpen(false);
    setSearchQuery("");
    router.push(q ? `/${envSlug}?q=${encodeURIComponent(q)}#catalog` : `/${envSlug}#catalog`);
  }

  const navLinkStyle = { color: v.heading };

  return (
    <>
      <div className="store-site-header sticky top-0 z-50">
        <div
          className="hidden py-1.5 text-center sm:block"
          style={{ backgroundColor: v.badgeBg, borderBottom: `1px solid ${v.badgeBorder}` }}
        >
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: v.badgeText }}
          >
            {environment.config.tagline} · WhatsApp orders · Qatar delivery
          </p>
        </div>
        <div
          className="py-1.5 text-center sm:hidden"
          style={{ backgroundColor: v.badgeBg, borderBottom: `1px solid ${v.badgeBorder}` }}
        >
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: v.badgeText }}
          >
            WhatsApp orders · Qatar
          </p>
        </div>

        <header className="glass-nav">
        <div className="container-pawmart" ref={menuRef}>
          <div className="flex h-16 items-center justify-between gap-3 md:h-[4.5rem]">
            <Link href={`/${envSlug}`} prefetch className="group flex min-w-0 shrink items-center gap-2 sm:gap-3">
              {brandImage ? (
                <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#0a0a0a]">
                  <Image
                    src={brandImage}
                    alt={environment.config.displayName}
                    width={44}
                    height={44}
                    className="h-9 w-9 object-contain"
                  />
                </span>
              ) : (
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ background: v.gradientAccent, color: v.heading }}
                >
                  <EnvIcon slug={envSlug} className="h-4 w-4" />
                </span>
              )}
              <div className="flex min-w-0 flex-col leading-none">
                <span
                  className="truncate font-display text-base font-medium tracking-tight sm:text-lg md:text-xl"
                  style={{ color: v.heading }}
                >
                  {environment.config.displayName}
                </span>
                <span
                  className="mt-0.5 text-[8px] font-semibold uppercase tracking-[0.25em]"
                  style={{ color: v.muted }}
                >
                  by TFRC
                </span>
              </div>
            </Link>

            <nav className="hidden items-center lg:flex" aria-label="Main navigation">
              <Link
                href={`/${envSlug}`}
                className="nav-link px-3 py-5 text-[13px] font-medium"
                style={navLinkStyle}
              >
                Home
              </Link>
              <Link
                href={`/${envSlug}#catalog`}
                className="nav-link px-3 py-5 text-[13px] font-medium"
                style={navLinkStyle}
              >
                Shop all
              </Link>

              {shopCategories.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setCategoriesOpen(!categoriesOpen);
                      setCatalogueOpen(false);
                    }}
                    className="nav-link flex items-center gap-1 px-3 py-5 text-[13px] font-medium"
                    style={navLinkStyle}
                  >
                    Categories
                    <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                  </button>
                  {categoriesOpen && (
                    <div
                      className="glass-panel animate-dropdown absolute left-0 top-full z-50 min-w-[240px] p-2"
                    >
                      {shopCategories.map((cat) => (
                        <Link
                          key={cat.slug}
                          href={`/${envSlug}?shop=${cat.slug}#category-${cat.slug}`}
                          className="flex items-center justify-between rounded-xl px-4 py-2.5 text-sm transition-colors hover:bg-black/[0.03]"
                          style={{ color: v.body }}
                          onClick={() => setCategoriesOpen(false)}
                        >
                          <span>{cat.name}</span>
                          {cat.productCount != null && (
                            <span className="text-xs opacity-50">{cat.productCount}</span>
                          )}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <Link
                href={`/${envSlug}#deals`}
                className="nav-link px-3 py-5 text-[13px] font-medium"
                style={{ color: v.accent }}
              >
                Deals
              </Link>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setCatalogueOpen(!catalogueOpen);
                    setCategoriesOpen(false);
                  }}
                  className="nav-link flex items-center gap-1 px-3 py-5 text-[13px] font-medium"
                  style={navLinkStyle}
                >
                  All Catalogues
                  <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                </button>
                {catalogueOpen && (
                  <div className="glass-panel animate-dropdown absolute right-0 top-full z-50 w-72 p-2">
                    <Link
                      href="/"
                      className="block rounded-xl px-3 py-2.5 text-xs transition-colors hover:bg-black/[0.03]"
                      style={{ color: v.muted }}
                      onClick={() => setCatalogueOpen(false)}
                    >
                      ← TFRC Vita Nova Home
                    </Link>
                    {ENVIRONMENT_CONFIGS.map((env) => {
                      const ev = getEnvVisual(env.slug);
                      return (
                        <Link
                          key={env.slug}
                          href={`/${env.slug}`}
                          className="mt-1 flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors hover:bg-black/[0.03]"
                          style={{
                            backgroundColor: env.slug === envSlug ? ev.badgeBg : undefined,
                            color: v.heading,
                            fontWeight: env.slug === envSlug ? 600 : 400,
                          }}
                          onClick={() => setCatalogueOpen(false)}
                        >
                          <span
                            className="flex h-8 w-8 items-center justify-center rounded-lg"
                            style={{ background: ev.gradientAccent, color: ev.heading }}
                          >
                            <EnvIcon slug={env.slug} className="h-3.5 w-3.5" />
                          </span>
                          {env.displayName}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </nav>

            <div className="flex items-center gap-1 md:gap-2">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="touch-target flex items-center justify-center rounded-full transition-colors hover:bg-black/[0.04]"
                style={{ color: v.heading }}
                aria-label="Search"
              >
                <Search className="h-5 w-5" strokeWidth={1.5} />
              </button>
              <CartButton onClick={() => setCartOpen(true)} />
              <div className="hidden sm:block">
                <WhatsAppButton href={waHref} size="sm" />
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="touch-target flex items-center justify-center rounded-full lg:hidden"
                style={{ color: v.heading }}
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>
      </div>

      {searchOpen && (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm">
          <div className="container-pawmart pt-24">
            <form onSubmit={handleSearch} className="mx-auto max-w-xl">
              <div className="glass-panel flex overflow-hidden">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search ${environment.config.displayName}...`}
                  className="flex-1 bg-transparent px-5 py-4 text-base outline-none"
                  style={{ color: v.heading }}
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-6 text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: v.cta }}
                >
                  <Search className="h-5 w-5" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="mt-4 text-sm font-medium"
                style={{ color: v.muted }}
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}

      {mobileOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div
            className="animate-slide-in-right absolute inset-y-0 right-0 flex w-[min(100%,320px)] flex-col"
            style={{ backgroundColor: v.surface }}
          >
            <div
              className="flex items-center justify-between p-4"
              style={{ borderBottom: `1px solid ${v.border}` }}
            >
              <span className="font-semibold" style={{ color: v.heading }}>
                {environment.config.displayName}
              </span>
              <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close">
                <X className="h-5 w-5" style={{ color: v.heading }} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-4">
              <Link
                href={`/${envSlug}`}
                className="block py-3 font-medium"
                style={{ color: v.heading }}
                onClick={() => setMobileOpen(false)}
              >
                Home
              </Link>
              <Link
                href={`/${envSlug}#catalog`}
                className="block py-3 font-medium"
                style={{ color: v.heading }}
                onClick={() => setMobileOpen(false)}
              >
                Shop All
              </Link>
              <Link
                href={`/${envSlug}#deals`}
                className="block py-3 font-medium"
                style={{ color: v.accent }}
                onClick={() => setMobileOpen(false)}
              >
                Today&apos;s Deals
              </Link>
              {shopCategories.length > 0 && (
                <div className="py-2" style={{ borderTop: `1px solid ${v.border}` }}>
                  <p
                    className="py-2 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: v.muted }}
                  >
                    Categories
                  </p>
                  {shopCategories.map((cat) => (
                    <Link
                      key={cat.slug}
                      href={`/${envSlug}?shop=${cat.slug}#category-${cat.slug}`}
                      className="flex items-center justify-between py-2 pl-2 text-sm"
                      style={{ color: v.body }}
                      onClick={() => setMobileOpen(false)}
                    >
                      <span>{cat.name}</span>
                      {cat.productCount != null && (
                        <span className="text-xs opacity-50">{cat.productCount}</span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
              <Link
                href="/"
                className="mt-4 flex items-center gap-2 py-3 text-sm"
                style={{ color: v.accent }}
                onClick={() => setMobileOpen(false)}
              >
                <ArrowRight className="h-4 w-4 rotate-180" /> All Catalogues
              </Link>
            </nav>
            <div className="p-4" style={{ borderTop: `1px solid ${v.border}` }}>
              <WhatsAppButton href={waHref} fullWidth />
            </div>
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
