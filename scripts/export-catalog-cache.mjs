/**
 * Export catalog-cache from the LIVE owner database only.
 *
 * Never bake the shipped seed catalogues into a deploy artifact — that is what
 * made every code push look like it "replaced" the client's uploaded data.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import {
  canWriteDir,
  persistentCachePath,
  persistentDataDir,
  resolveLiveDbPath,
  seedDbPath,
} from "./lib/db-location.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnv({ path: path.join(root, ".env") });
loadEnv({ path: path.join(root, ".env.local"), override: true });
loadEnv({ path: path.join(root, "prisma", ".env") });

const live = resolveLiveDbPath(root);
const seed = seedDbPath(root);
const allowSeedFallback = process.env.TFRC_ALLOW_SEED_CACHE === "1";

let dbFile = live?.path ?? null;
let source = live?.source ?? null;

if (!dbFile && allowSeedFallback && seed) {
  dbFile = seed;
  source = "seed-explicit";
}

const outFiles = [path.join(root, "data", "catalog-cache.json")];
if (canWriteDir(persistentDataDir(root))) {
  outFiles.unshift(persistentCachePath(root));
}

function writeCache(cache) {
  const payload = JSON.stringify(cache);
  for (const outFile of outFiles) {
    try {
      fs.mkdirSync(path.dirname(outFile), { recursive: true });
      const temporary = `${outFile}.${process.pid}.tmp`;
      fs.writeFileSync(temporary, payload);
      fs.renameSync(temporary, outFile);
      console.log(
        `[catalog-cache] wrote ${outFile} (${(fs.statSync(outFile).size / 1024 / 1024).toFixed(2)} MB)`
      );
    } catch (err) {
      console.warn(`[catalog-cache] could not write ${outFile}:`, err?.message ?? err);
    }
  }
}

if (!dbFile || !fs.existsSync(dbFile)) {
  console.warn(
    "[catalog-cache] No LIVE owner database found — writing empty cache (will not ship seed catalogues)."
  );
  writeCache({ generatedAt: new Date().toISOString(), environments: {} });
  process.exit(0);
}

console.log(
  `[catalog-cache] reading ${dbFile} (${fs.statSync(dbFile).size} bytes) via ${source || "unknown"}`
);

const prisma = new PrismaClient({
  datasources: { db: { url: `file:${path.resolve(dbFile).replace(/\\/g, "/")}` } },
});

try {
  const envs = await prisma.environment.findMany({
    where: { status: "ACTIVE" },
    orderBy: { sortOrder: "asc" },
  });

  const cache = {
    generatedAt: new Date().toISOString(),
    environments: {},
  };

  for (const env of envs) {
    if (String(env.slug).startsWith("replace-persist-")) continue;

    const products = await prisma.product.findMany({
      where: { environmentId: env.id, status: "ACTIVE", deletedAt: null },
      include: {
        images: { orderBy: { sortOrder: "asc" }, take: 8 },
        videos: { orderBy: { sortOrder: "asc" }, take: 2 },
        prices: true,
        brand: { select: { id: true, name: true, slug: true } },
        inventory: { select: { isInStock: true } },
        category: { select: { id: true, name: true, slug: true } },
        subcategory: { select: { id: true, name: true, slug: true } },
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

    const shopCategories = await prisma.shopCategory.findMany({
      where: { environmentId: env.id, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { slug: true, name: true, sortOrder: true, imageUrl: true },
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
      shopCategories,
      products,
    };
  }

  writeCache(cache);
  console.log(
    `[catalog-cache] exported ${Object.keys(cache.environments).length} live catalogue(s)`
  );
} finally {
  await prisma.$disconnect();
}
