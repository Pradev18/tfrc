/**
 * Export a Prisma-free catalog cache for Hostinger fallback.
 * Written to data/catalog-cache.json and copied into .next on build.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbFile = path.join(root, "prisma", "prod.db");
const outFile = path.join(root, "data", "catalog-cache.json");

const prisma = new PrismaClient({
  datasources: { db: { url: `file:${dbFile}` } },
});

const envs = await prisma.environment.findMany({
  where: { status: "ACTIVE" },
  orderBy: { sortOrder: "asc" },
});

const cache = {
  generatedAt: new Date().toISOString(),
  environments: {},
};

for (const env of envs) {
  const products = await prisma.product.findMany({
    where: { environmentId: env.id, status: "ACTIVE", deletedAt: null },
    include: {
      images: { orderBy: { sortOrder: "asc" }, take: 2 },
      prices: true,
      brand: { select: { id: true, name: true, slug: true } },
      inventory: { select: { isInStock: true } },
    },
    orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
  });

  const brands = await prisma.brand.findMany({
    where: {
      isActive: true,
      products: { some: { environmentId: env.id, status: "ACTIVE" } },
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  });

  cache.environments[env.slug] = {
    id: env.id,
    name: env.name,
    slug: env.slug,
    tagline: env.tagline,
    description: env.description,
    logoUrl: env.logoUrl,
    icon: env.icon,
    theme: env.theme,
    seo: env.seo,
    settings: env.settings,
    departmentSource: env.departmentSource,
    brands,
    products,
  };
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(cache));
console.log(
  `[catalog-cache] wrote ${outFile} (${(fs.statSync(outFile).size / 1024 / 1024).toFixed(2)} MB)`
);

await prisma.$disconnect();
