import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { resolveEnvironment, isValidEnvironmentSlug } from "@/services/environment.service";
import { StoreHeader } from "@/components/public/StoreHeader";
import { Footer } from "@/components/public/Footer";
import { buildPageMetadata } from "@/lib/meta-seo";
import { getEnvironmentHeroImages } from "@/services/category.service";
import { getEnvVisual, envStyle } from "@/lib/env-visuals";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ environment: string }>;
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { environment: slug } = await params;
  if (!isValidEnvironmentSlug(slug)) return { title: "Not Found" };
  const env = await resolveEnvironment(slug);
  if (!env) return { title: "Not Found" };

  const heroImages = await getEnvironmentHeroImages(slug);

  return buildPageMetadata({
    title: env.seoParsed.title,
    description: env.seoParsed.description,
    path: `/${slug}`,
    keywords: env.seoParsed.keywords,
    image: heroImages[0] ?? null,
    imageAlt: env.config.displayName,
  });
}

export default async function EnvironmentLayout({ children, params }: LayoutProps) {
  const { environment: slug } = await params;

  if (!isValidEnvironmentSlug(slug)) notFound();

  const environment = await resolveEnvironment(slug);
  if (!environment) notFound();

  const v = getEnvVisual(slug);

  return (
    <div style={{ ...envStyle(v), backgroundColor: v.sectionAlt }}>
      <StoreHeader environment={environment} />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
