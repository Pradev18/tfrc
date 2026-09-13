/**
 * Generate a local PDF HTML preview from LIVE catalogue data (same path as production).
 *
 * Usage:
 *   npx tsx scripts/generate-pdf-preview.ts
 *   npx tsx scripts/generate-pdf-preview.ts pawmart
 *   npx tsx scripts/generate-pdf-preview.ts <catalogueId>
 *
 * Never invents Sample Product / example.com data.
 */
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";
import { config as loadEnv } from "dotenv";

loadEnv({ path: resolve(process.cwd(), ".env") });
loadEnv({ path: resolve(process.cwd(), ".env.local"), override: true });

// Stub Next.js "server-only" so the shared service can run in a Node script.
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
  const { getCataloguePdfPayload } = await import("../src/services/catalogue-pdf.service");
  const { assembleCataloguePdfHtml } = await import("../src/lib/catalogue-pdf-build");
  const { getSiteUrl } = await import("../src/lib/site-config");

  async function resolveCatalogueId(arg?: string): Promise<string> {
    if (arg) {
      const byId = await prisma.environment.findUnique({
        where: { id: arg },
        select: { id: true },
      });
      if (byId) return byId.id;
      const bySlug = await prisma.environment.findUnique({
        where: { slug: arg },
        select: { id: true },
      });
      if (bySlug) return bySlug.id;
      throw new Error(`Catalogue not found for id/slug: ${arg}`);
    }

    const withProducts = await prisma.environment.findFirst({
      where: {
        status: "ACTIVE",
        products: { some: { deletedAt: null, status: "ACTIVE" } },
      },
      orderBy: { sortOrder: "asc" },
      select: { id: true, slug: true, name: true },
    });
    if (!withProducts) {
      throw new Error("No active catalogue with products found in the database.");
    }
    console.log(`Using catalogue: ${withProducts.name} (${withProducts.slug})`);
    return withProducts.id;
  }

  try {
    const arg = process.argv[2];
    const catalogueId = await resolveCatalogueId(arg);
    const payload = await getCataloguePdfPayload(catalogueId);
    if (!payload) {
      throw new Error(`getCataloguePdfPayload returned null for ${catalogueId}`);
    }

    const { html, stats } = await assembleCataloguePdfHtml(payload, {
      origin: getSiteUrl(),
      autoPrint: false,
    });

    const banned = [
      "Sample Product",
      "example.com/pawmart",
      ">P1</text>",
      ">P2</text>",
      ">P3</text>",
    ];
    for (const needle of banned) {
      if (html.includes(needle)) {
        throw new Error(`Preview HTML still contains forbidden demo content: ${needle}`);
      }
    }

    if (!stats.sampleNames.length) {
      throw new Error("Payload produced zero product cards — check catalogue data.");
    }

    const out = resolve(process.cwd(), "tmp-catalogue-pdf-preview.html");
    writeFileSync(out, html, "utf8");

    console.log("Wrote", out);
    console.log(
      JSON.stringify(
        {
          catalogue: stats.catalogueName,
          slug: stats.catalogueSlug,
          websiteUrl: stats.websiteUrl,
          whatsappPhone: stats.whatsappPhone,
          totalProducts: stats.totalProducts,
          listedCards: stats.listedCards,
          categories: stats.categories,
          embeddedProductImages: stats.embeddedProductImages,
          fallbackProductImages: stats.fallbackProductImages,
          sampleNames: stats.sampleNames,
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
