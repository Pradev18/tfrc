"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Menu,
  X,
  Search,
  ChevronDown,
  ArrowRight,
} from "lucide-react";
import { WhatsAppButton } from "@/components/public/WhatsAppButton";
import { shortLabel } from "@/lib/nav-labels";
import type { NavCategory } from "@/services/category.service";

interface SiteHeaderProps {
  categories: NavCategory[];
  waHref: string;
}

export function SiteHeader({ categories, waHref }: SiteHeaderProps) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mobileOpen || searchOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen, searchOpen]);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
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
    router.push(q ? `/catalogue?q=${encodeURIComponent(q)}` : "/catalogue");
  }

  return (
    <>
      <div className="bg-primary py-2 text-center">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary-foreground/90">
          Premium catalogue · Qatar-wide delivery · Order on WhatsApp
        </p>
      </div>

      <header className="sticky top-0 z-50 border-b border-border bg-surface">
        <div className="container-pawmart" ref={menuRef}>
          <div className="flex h-16 items-center justify-between gap-4 md:h-[4.5rem]">
            <Link href="/" prefetch className="group flex shrink-0 flex-col leading-none">
              <span className="text-display text-[1.6rem] font-medium tracking-tight text-primary md:text-[1.75rem]">
                PawMart
              </span>
              <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.35em] text-text-subtle">
                Qatar
              </span>
            </Link>

            {/* Desktop nav with mega dropdowns */}
            <nav className="hidden items-center lg:flex" aria-label="Main navigation">
              <Link
                href="/catalogue"
                prefetch
                className="nav-link px-4 py-5 text-[13px] font-medium text-text"
              >
                Catalogue
              </Link>

              {categories.map((cat) => (
                <div key={cat.id} className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveMenu(activeMenu === cat.id ? null : cat.id)
                    }
                    onMouseEnter={() => setActiveMenu(cat.id)}
                    className={`nav-link flex items-center gap-1 px-4 py-5 text-[13px] font-medium ${
                      activeMenu === cat.id ? "text-primary" : "text-text-muted"
                    }`}
                    aria-expanded={activeMenu === cat.id}
                  >
                    {shortLabel(cat.name)}
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform duration-200 ${
                        activeMenu === cat.id ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {activeMenu === cat.id && (
                    <div
                      className="animate-dropdown absolute left-0 top-full z-50 w-[420px] border border-border bg-surface shadow-[var(--shadow-card)]"
                      onMouseLeave={() => setActiveMenu(null)}
                    >
                      {cat.coverImage && (
                        <Link
                          href={`/catalogue/${cat.slug}`}
                          prefetch
                          onClick={() => setActiveMenu(null)}
                          className="group relative block h-36 overflow-hidden"
                        >
                          <Image
                            src={cat.coverImage}
                            alt={cat.name}
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                            sizes="420px"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-primary/90 to-transparent" />
                          <div className="absolute bottom-0 left-0 p-4">
                            <p className="text-display text-lg text-white">{cat.name}</p>
                            <p className="text-[10px] uppercase tracking-wider text-white/70">
                              {cat.productCount} products
                            </p>
                          </div>
                        </Link>
                      )}
                      <div className="p-4">
                        <Link
                          href={`/catalogue/${cat.slug}`}
                          prefetch
                          onClick={() => setActiveMenu(null)}
                          className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-primary hover:underline"
                        >
                          View all {shortLabel(cat.name)}
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                        {cat.children.length > 0 ? (
                          <ul className="grid gap-1">
                            {cat.children.map((child) => (
                              <li key={child.id}>
                                <Link
                                  href={`/catalogue/${child.slug}`}
                                  prefetch
                                  onClick={() => setActiveMenu(null)}
                                  className="flex items-center justify-between rounded px-2 py-2 text-sm text-text-muted transition-colors hover:bg-surface-muted hover:text-primary"
                                >
                                  {child.name}
                                  <span className="text-[10px] text-text-subtle">
                                    {child.productCount}
                                  </span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-text-muted">
                            Browse the full {shortLabel(cat.name)} collection
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <Link
                href="/offers"
                prefetch
                className="nav-link px-4 py-5 text-[13px] font-medium text-text"
              >
                Offers
              </Link>
            </nav>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="flex h-9 w-9 items-center justify-center border border-border bg-background text-text-muted hover:border-primary hover:text-primary"
                aria-label="Search"
              >
                <Search className="h-4 w-4" strokeWidth={1.75} />
              </button>
              <WhatsAppButton
                href={waHref}
                label="WhatsApp"
                size="sm"
                className="hidden sm:inline-flex !px-4 !py-2.5"
              />
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="flex h-9 w-9 items-center justify-center border border-border lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Search overlay */}
      {searchOpen && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center bg-black/50 pt-24">
          <div className="animate-fade-in w-full max-w-xl px-4">
            <form
              onSubmit={handleSearch}
              className="flex overflow-hidden border border-border bg-surface shadow-[var(--shadow-card)]"
            >
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products, brands, categories..."
                className="flex-1 px-5 py-4 text-base outline-none"
              />
              <button type="submit" className="bg-primary px-6 text-sm font-semibold uppercase tracking-wider text-primary-foreground">
                Search
              </button>
            </form>
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              className="mt-4 w-full py-2 text-sm text-white/80 hover:text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[200] lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="animate-slide-in-right absolute right-0 top-0 flex h-full w-[min(100%,340px)] flex-col bg-surface shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <span className="text-display text-xl text-primary">Menu</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex h-9 w-9 items-center justify-center border border-border"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto">
              <MobileNavLink href="/catalogue" onClose={() => setMobileOpen(false)} bold>
                Catalogue
              </MobileNavLink>

              {categories.map((cat) => (
                <MobileCategoryGroup
                  key={cat.id}
                  category={cat}
                  onClose={() => setMobileOpen(false)}
                />
              ))}

              <MobileNavLink href="/offers" onClose={() => setMobileOpen(false)} bold>
                Offers
              </MobileNavLink>
              <MobileNavLink href="/about" onClose={() => setMobileOpen(false)}>
                About
              </MobileNavLink>
              <MobileNavLink href="/contact" onClose={() => setMobileOpen(false)}>
                Contact
              </MobileNavLink>
            </nav>

            <div className="space-y-3 border-t border-border p-5">
              <WhatsAppButton href={waHref} label="WhatsApp" fullWidth />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MobileNavLink({
  href,
  children,
  onClose,
  bold,
}: {
  href: string;
  children: React.ReactNode;
  onClose: () => void;
  bold?: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch
      onClick={onClose}
      className={`block border-b border-border px-5 py-4 text-sm ${
        bold ? "font-semibold uppercase tracking-wider text-text" : "text-text-muted"
      }`}
    >
      {children}
    </Link>
  );
}

function MobileCategoryGroup({
  category,
  onClose,
}: {
  category: NavCategory;
  onClose: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-5 py-4 text-sm font-medium text-text"
      >
        {shortLabel(category.name)}
        <ChevronDown
          className={`h-4 w-4 text-text-subtle transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded && (
        <div className="animate-fade-in bg-surface-muted pb-2">
          {category.coverImage && (
            <Link href={`/catalogue/${category.slug}`} prefetch onClick={onClose} className="relative mx-3 mb-2 block h-24 overflow-hidden">
              <Image src={category.coverImage} alt="" fill className="object-cover" sizes="300px" />
              <div className="absolute inset-0 bg-primary/40" />
            </Link>
          )}
          <Link
            href={`/catalogue/${category.slug}`}
            prefetch
            onClick={onClose}
            className="block px-5 py-2 text-sm font-medium text-primary"
          >
            All {shortLabel(category.name)}
          </Link>
          {category.children.map((child) => (
            <Link
              key={child.id}
              href={`/catalogue/${child.slug}`}
              prefetch
              onClick={onClose}
              className="block px-5 py-2 text-sm text-text-muted"
            >
              {child.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
