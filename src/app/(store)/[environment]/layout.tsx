import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { resolveEnvironment, isValidEnvironmentSlug } from "@/services/environment.service";
import { StoreHeader } from "@/components/public/StoreHeader";
import { StoreFooter } from "@/components/store/StoreFooter";
import { buildPageMetadata } from "@/lib/meta-seo";
import { getEnvironmentHeroImages } from "@/services/category.service";
import { getEnvVisual, envStyle } from "@/lib/env-visuals";

export const revalidate = 60;

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ environment: string }>;
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

  let environment;
  try {
    if (!(await isValidEnvironmentSlug(slug))) notFound();
    environment = await resolveEnvironment(slug);
  } catch (error) {
    console.error("[store-layout] DB error:", error);
    throw error;
  }

  if (!environment) notFound();

  const v = getEnvVisual(slug);

  return (
    <div style={{ ...envStyle(v), backgroundColor: v.sectionAlt }} className="overflow-x-clip">
      <StoreHeader environment={environment} />
      <main>{children}</main>
      <StoreFooter environment={environment} />
    </div>
  );
}
