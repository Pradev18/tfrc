import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  resolveEnvironment,
  isValidEnvironmentSlug,
  environmentFromCacheOrConfig,
  type ParsedEnvironment,
} from "@/services/environment.service";
import { StoreHeader } from "@/components/public/StoreHeader";
import { StoreFooter } from "@/components/store/StoreFooter";
import { buildPageMetadata } from "@/lib/meta-seo";
import { getEnvironmentHeroImages } from "@/services/category.service";
import { getEnvVisual, envStyle } from "@/lib/env-visuals";
import { getEnvironmentConfig } from "@/lib/environments";
import { CustomerActivityTracker } from "@/components/analytics/CustomerActivityTracker";
import {
  hasCatalogueUnlockCookie,
  isCatalogueLockedFromSettings,
  getCatalogueLockState,
} from "@/lib/catalogue-lock";
import { StoreCatalogueUnlockGate } from "@/components/public/StoreCatalogueUnlockGate";

export const revalidate = 60;

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ environment: string }>;
}

function isNextNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    (error as { digest?: string }).digest === "NEXT_NOT_FOUND"
  );
}

function StoreHeaderFallback({ environment }: { environment: ParsedEnvironment }) {
  return (
    <header className="border-b border-black/[0.06] bg-white/90">
      <div className="mx-auto flex h-14 max-w-7xl items-center px-4">
        <span className="text-lg font-semibold tracking-tight">
          {environment.config.displayName}
        </span>
      </div>
    </header>
  );
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  try {
    const { environment: slug } = await params;
    if (!(await isValidEnvironmentSlug(slug))) return { title: "Not Found" };
    const env = await resolveEnvironment(slug);
    if (!env) return { title: "Not Found" };

    const heroImages = await getEnvironmentHeroImages(slug);

    return buildPageMetadata({
      title: env.seoParsed.title || `${env.config.displayName} Catalogue Qatar | TFRC`,
      description:
        env.seoParsed.description ||
        `Browse ${env.config.displayName} by category in Qatar. Order on WhatsApp with TFRC.`,
      path: `/${slug}`,
      keywords: env.seoParsed.keywords?.length
        ? env.seoParsed.keywords
        : [env.config.displayName.toLowerCase(), "tfrc", "qatar", "catalogue"],
      image: heroImages[0] ?? null,
      imageAlt: `${env.config.displayName} | TFRC`,
    });
  } catch {
    return { title: "Catalogue" };
  }
}

export default async function EnvironmentLayout({ children, params }: LayoutProps) {
  const { environment: slug } = await params;

  let environment = null;
  try {
    const valid = await isValidEnvironmentSlug(slug);
    if (!valid && !getEnvironmentConfig(slug)) notFound();
    environment = await resolveEnvironment(slug);
  } catch (error) {
    if (isNextNotFound(error)) throw error;
    console.error("[store-layout] soft-fail, serving without hard crash:", error);
  }

  if (!environment) {
    environment = environmentFromCacheOrConfig(slug);
  }

  if (!environment) notFound();

  const v = getEnvVisual(slug);

  // Same admin catalogue lock also gates the public storefront.
  // Always verify against the live DB state (cache settings can be stale).
  let needsUnlock = false;
  if (!environment.id.startsWith("static-")) {
    const lockState = await getCatalogueLockState(environment.id);
    const locked =
      lockState.isLocked || isCatalogueLockedFromSettings(environment.settings);
    if (locked) {
      needsUnlock = !(await hasCatalogueUnlockCookie(environment.id));
    }
  }

  return (
    <div style={{ ...envStyle(v), backgroundColor: v.sectionAlt }} className="overflow-x-clip">
      <CustomerActivityTracker
        environmentSlug={slug}
        environmentName={environment.config.displayName}
      />
      <Suspense fallback={<StoreHeaderFallback environment={environment} />}>
        <StoreHeader environment={environment} />
      </Suspense>
      <main>
        {needsUnlock ? (
          <StoreCatalogueUnlockGate
            environmentSlug={slug}
            environmentName={environment.config.displayName}
          />
        ) : (
          children
        )}
      </main>
      <StoreFooter environment={environment} />
    </div>
  );
}
