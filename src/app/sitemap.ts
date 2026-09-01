import type { MetadataRoute } from "next";
import prisma from "@/lib/db";
import { ENVIRONMENT_CONFIGS } from "@/lib/environments";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const products = await prisma.product.findMany({
    where: { status: "ACTIVE", deletedAt: null },
    select: { slug: true, updatedAt: true, environment: { select: { slug: true } } },
  });

  const categories = await prisma.category.findMany({
    where: { isActive: true, environmentId: { not: null } },
    select: { slug: true, updatedAt: true, environment: { select: { slug: true } } },
  });

  return [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    ...ENVIRONMENT_CONFIGS.flatMap((env) => [
      {
        url: `${baseUrl}/${env.slug}`,
        lastModified: new Date(),
        changeFrequency: "daily" as const,
        priority: 0.95,
      },
      {
        url: `${baseUrl}/${env.slug}/catalogue`,
        lastModified: new Date(),
        changeFrequency: "daily" as const,
        priority: 0.9,
      },
    ]),
    ...categories
      .filter((c) => c.environment?.slug)
      .map((c) => ({
        url: `${baseUrl}/${c.environment!.slug}/catalogue/${c.slug}`,
        lastModified: c.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    ...products
      .filter((p) => p.environment?.slug)
      .map((p) => ({
        url: `${baseUrl}/${p.environment!.slug}/product/${p.slug}`,
        lastModified: p.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
  ];
}
