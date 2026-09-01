import type { MetadataRoute } from "next";
import prisma from "@/lib/db";
import { getSiteUrl } from "@/lib/site-config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl();

  const [products, categories, environments] = await Promise.all([
    prisma.product.findMany({
      where: { status: "ACTIVE", deletedAt: null },
      select: { slug: true, updatedAt: true, environment: { select: { slug: true } } },
    }),
    prisma.category.findMany({
      where: { isActive: true, environmentId: { not: null } },
      select: { slug: true, updatedAt: true, environment: { select: { slug: true } } },
    }),
    prisma.environment.findMany({
      where: { status: "ACTIVE" },
      select: { slug: true, updatedAt: true },
    }),
  ]);

  return [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    ...environments.flatMap((env) => [
      {
        url: `${baseUrl}/${env.slug}`,
        lastModified: env.updatedAt,
        changeFrequency: "daily" as const,
        priority: 0.95,
      },
      {
        url: `${baseUrl}/${env.slug}/catalogue`,
        lastModified: env.updatedAt,
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
