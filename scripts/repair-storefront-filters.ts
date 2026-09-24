/**
 * One-shot: backfill itemNo + regenerate shop categories + refresh catalog cache
 * for every active catalogue. Safe to re-run.
 */
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: resolve(process.cwd(), ".env") });

const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve("server-only");
require.cache[serverOnlyPath] = {
  id: serverOnlyPath,
  filename: serverOnlyPath,
  loaded: true,
  exports: {},
} as NodeModule;

async function main() {
  const { default: prisma } = await import("../src/lib/db");
  const { generateShopCategories } = await import(
    "../src/services/catalogue-admin.service"
  );
  const { persistRuntimeCatalogueData } = await import(
    "../src/lib/persist-runtime-data.server"
  );

  try {
    const envs = await prisma.environment.findMany({
      where: { status: "ACTIVE" },
      orderBy: { sortOrder: "asc" },
      select: { id: true, slug: true, name: true },
    });

    for (const env of envs) {
      if (env.slug.startsWith("replace-persist-")) continue;
      const n = await generateShopCategories(env.id, env.slug);
      console.log(`✓ ${env.name} (${env.slug}): shop categories=${n}`);
    }

    await persistRuntimeCatalogueData();
    console.log("✓ catalog-cache refreshed from live DB");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
