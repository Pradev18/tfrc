"use client";

import Link from "next/link";
import { TfrcBrand } from "@/components/brand/TfrcBrand";
import { useT } from "@/context/LanguageContext";

interface StoreFooterI18nProps {
  environmentSlug: string;
  displayName: string;
  waHref: string;
  otherCatalogues: Array<{ slug: string; displayName: string }>;
}

export function StoreFooterI18n({
  environmentSlug,
  displayName,
  waHref,
  otherCatalogues,
}: StoreFooterI18nProps) {
  const t = useT();

  return (
    <>
      <div className="grid gap-8 md:grid-cols-3">
        <div>
          <TfrcBrand
            className="gap-2"
            iconClassName="h-4 brightness-0 invert"
            textClassName="text-lg font-semibold text-white"
          />
          <p className="mt-2 text-sm font-semibold opacity-95">{displayName}</p>
          <p className="mt-1 text-xs opacity-60">{t("store.footerTagline")}</p>
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex rounded-full border border-white/25 px-4 py-2 text-xs font-semibold transition-colors hover:bg-white/10"
          >
            {t("nav.orderOnWhatsApp")}
          </a>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-50">
            {t("store.shop")}
          </p>
          <ul className="mt-3 space-y-2 text-sm opacity-80">
            <li>
              <Link href={`/${environmentSlug}#catalog`} className="hover:opacity-100">
                {t("store.browseCategories")}
              </Link>
            </li>
            <li>
              <Link href={`/${environmentSlug}#catalog`} className="hover:opacity-100">
                {t("store.allProducts")}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-50">
            {t("nav.catalogues")}
          </p>
          <ul className="mt-3 space-y-2 text-sm opacity-80">
            <li>
              <Link href="/" className="hover:opacity-100">
                {t("nav.allCatalogues")}
              </Link>
            </li>
            {otherCatalogues.map((env) => (
              <li key={env.slug}>
                <Link href={`/${env.slug}`} className="hover:opacity-100">
                  {env.displayName}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-8 text-center text-[11px] opacity-40">
        {t("store.copyright", { year: new Date().getFullYear() })}
      </p>
    </>
  );
}
