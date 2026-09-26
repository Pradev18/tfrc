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
  normalizeDatabaseUrl,
  persistentCachePath,
  persistentDataDir,
  resolveLiveDbPath,
  seedDbPath,
} from "./lib/db-location.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnv({ path: path.join(root, ".env") });
loadEnv({ path: path.join(root, ".env.local"), override: true });
loadEnv({ path: path.join(root, "prisma", ".env") });

const dbUrl = normalizeDatabaseUrl(process.env.DATABASE_URL);
const isExternal = /^(postgresql|postgres|mysql|sqlserver):\/\//i.test(dbUrl);

const live = isExternal ? null : resolveLiveDbPath(root);
const seed = seedDbPath(root);
const allowSeedFallback = process.env.TFRC_ALLOW_SEED_CACHE === "1";

let dbFile = live?.path ?? null;
let source = live?.source ?? null;
let prismaUrl = null;

if (isExternal) {
  prismaUrl = dbUrl;
  source = "external-DATABASE_URL";
} else if (!dbFile && allowSeedFallback && seed) {
  dbFile = seed;
  source = "seed-explicit";
}

if (dbFile) {
  prismaUrl = `file:${path.resolve(dbFile).replace(/\\/g, "/")}`;
}

const outFiles = [path.join(root, "data", "catalog-cache.json")];
if (canWriteDir(persistentDataDir(root))) {
  outFiles.unshift(persistentCachePath(root));
}

function countCachedProducts(cache) {
  if (!cache?.environments || typeof cache.environments !== "object") return 0;
  let total = 0;
  for (const env of Object.values(cache.environments)) {
    const products = env?.products;
    if (Array.isArray(products)) total += products.length;
  }
  return total;
}

function writeCache(cache) {
  const payload = JSON.stringify(cache);
  const newProductCount = countCachedProducts(cache);
  for (const outFile of outFiles) {
    try {
      if (fs.existsSync(outFile)) {
        try {
          const existing = JSON.parse(fs.readFileSync(outFile, "utf8"));
          const existingCount = countCachedProducts(existing);
          const existingSize = fs.statSync(outFile).size;
          // Refuse empty/thinner overwrite of a rich persistent/app cache.
          if (
            existingCount > 0 &&
            (newProductCount === 0 || newProductCount < existingCount * 0.5)
          ) {
            console.warn(
              `[catalog-cache] Keeping richer ${outFile} (${existingCount} products, ${existingSize} bytes) — refuse thin export (${newProductCount} products)`
            );
            continue;
          }
        } catch {
          /* parse failed — overwrite */
        }
      }
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

if (!prismaUrl) {
  const existingPersistent = persistentCachePath(root);
  if (
    fs.existsSync(existingPersistent) &&
    fs.statSync(existingPersistent).size > 50
  ) {
    console.warn(
      "[catalog-cache] No LIVE DB readable — keeping existing persistent cache (refuse empty overwrite)."
    );
    process.exit(0);
  }
  console.warn(
    "[catalog-cache] No LIVE owner database found — writing empty cache (will not ship seed catalogues)."
  );
  writeCache({ generatedAt: new Date().toISOString(), environments: {} });
  process.exit(0);
}

console.log(
  `[catalog-cache] reading via ${source || "unknown"}` +
    (dbFile ? ` (${fs.statSync(dbFile).size} bytes)` : " (external DB)")
);

const prisma = new PrismaClient({
  datasources: { db: { url: prismaUrl } },
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
