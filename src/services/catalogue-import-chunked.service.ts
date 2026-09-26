/**
 * Fast catalogue Excel import — bulk Neon Postgres writes.
 * Target: ~1000 rows in well under 15–20s (exclusive heavy-job lock).
 * Still resumable across HTTP requests if a gateway kills a long request.
 */
import { mkdir, writeFile, readFile, unlink } from "fs/promises";
import path from "path";
import { randomBytes } from "node:crypto";
import prisma, { waitForDbReady } from "@/lib/db";
import { parseExcelBufferAsync } from "@/lib/import/catalog-parser";
import {
  createCategorySlug,
  rowToProductSlug,
  rowImages,
  rowCategorySegments,
  type CatalogRow,
} from "@/lib/import/catalog-parser";
import { ProductStatus } from "@prisma/client";
import { generateShopCategories, updateCatalogue } from "@/services/catalogue-admin.service";
import {
  classifyProductVariants,
  compareVariantLabels,
} from "@/lib/product-variants";
import { persistentUploadsDir } from "@/lib/sqlite-paths";

/** Rows processed per HTTP request (entire typical catalogue fits in one). */
const BULK_BATCH_SIZE = 1_000;
/** Stay under Hostinger/Cloudflare ~100s gateway when possible. */
const REQUEST_BUDGET_MS = 85_000;

type StoredImportPayload = {
  mode: "merge" | "replace";
  environmentId: string;
  environmentSlug: string;
  department: string;
  userId?: string;
  fileName: string;
  whatsappNumber: string | null;
  rows: CatalogRow[];
};

type JobStats = {
  fileKey?: string;
  mode?: "merge" | "replace";
  offset?: number;
  created?: number;
  updated?: number;
  archived?: number;
};

function importDir() {
  return path.join(persistentUploadsDir(), "catalogue-imports");
}

function payloadPath(jobId: string) {
  return path.join(importDir(), `${jobId}.json`);
}

function newId(): string {
  return `c${Date.now().toString(36)}${randomBytes(8).toString("hex")}`;
}

function parseSaleWindow(value: string | null): {
  saleStart: Date | null;
  saleEnd: Date | null;
} {
  if (!value) return { saleStart: null, saleEnd: null };
  const [startRaw, endRaw] = value.split("/");
  const start = startRaw ? new Date(startRaw) : null;
  const end = endRaw ? new Date(endRaw) : null;
  return {
    saleStart: start && !Number.isNaN(start.getTime()) ? start : null,
    saleEnd: end && !Number.isNaN(end.getTime()) ? end : null,
  };
}

function buildVariantMaps(rows: CatalogRow[]) {
  const classified = classifyProductVariants(
    rows.map((row) => ({
      id: row.id,
      productId: row.id,
      title: row.title,
      size: row.size,
      itemGroupId: row.item_group_id,
    }))
  );
  const variantIdentityById = new Map(
    classified.map((identity) => [identity.id, identity] as const)
  );
  const primaryIdByVariantGroup = new Map<string, string>();
  const grouped = new Map<string, typeof classified>();
  for (const identity of classified) {
    if (!identity.groupKey) continue;
    const group = grouped.get(identity.groupKey) ?? [];
    group.push(identity);
    grouped.set(identity.groupKey, group);
  }
  for (const [groupKey, group] of grouped) {
    group.sort((a, b) => compareVariantLabels(a.label, b.label));
    primaryIdByVariantGroup.set(groupKey, group[0]!.id);
  }
  return { variantIdentityById, primaryIdByVariantGroup };
}

async function failStaleImports(environmentId: string) {
  const cutoff = new Date(Date.now() - 45 * 60_000);
  await prisma.importJob.updateMany({
    where: {
      environmentId,
      status: "IMPORTING",
      createdAt: { lt: cutoff },
    },
    data: { status: "FAILED", completedAt: new Date(), failed: 1 },
  });
}

async function ensureBrands(rows: CatalogRow[]): Promise<Map<string, string>> {
  const bySlug = new Map<string, string>();
  for (const row of rows) {
    const name = row.brand.trim() || "Unknown";
    const slug = createCategorySlug(name);
    if (!bySlug.has(slug)) bySlug.set(slug, name);
  }
  const slugs = [...bySlug.keys()];
  if (slugs.length === 0) return new Map();

  await prisma.brand.createMany({
    data: slugs.map((slug) => ({
      id: newId(),
      name: bySlug.get(slug)!,
      slug,
    })),
    skipDuplicates: true,
  });

  const found = await prisma.brand.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true },
  });
  return new Map(found.map((b) => [b.slug, b.id]));
}

async function ensureTags(rows: CatalogRow[]): Promise<Map<string, string>> {
  const bySlug = new Map<string, string>();
  for (const row of rows) {
    for (const tagName of row.product_tags) {
      const name = tagName.trim();
      if (!name) continue;
      const slug = createCategorySlug(name);
      if (!bySlug.has(slug)) bySlug.set(slug, name);
    }
  }
  const slugs = [...bySlug.keys()];
  if (slugs.length === 0) return new Map();

  await prisma.tag.createMany({
    data: slugs.map((slug) => ({
      id: newId(),
      name: bySlug.get(slug)!,
      slug,
    })),
    skipDuplicates: true,
  });

  const found = await prisma.tag.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true },
  });
  return new Map(found.map((t) => [t.slug, t.id]));
}

async function ensureCategoryTrees(
  rows: CatalogRow[],
  environmentId: string,
  environmentSlug: string
): Promise<Map<string, { rootId: string; leafId: string }>> {
  type PathNode = {
    pathKey: string;
    name: string;
    parentPath: string | null;
    depth: number;
    slug: string;
  };

  const nodes = new Map<string, PathNode>();
  const rowPaths: string[][] = [];

  for (const row of rows) {
    const segments = rowCategorySegments(row);
    rowPaths.push(segments);
    const fullPath: string[] = [];
    let parentPath: string | null = null;
    for (let i = 0; i < segments.length; i++) {
      const name = segments[i]!;
      fullPath.push(name);
      const pathKey = fullPath.join(" > ");
      if (!nodes.has(pathKey)) {
        nodes.set(pathKey, {
          pathKey,
          name,
          parentPath,
          depth: i,
          slug: createCategorySlug(`${environmentSlug}-${pathKey}`),
        });
      }
      parentPath = pathKey;
    }
  }

  const cache = new Map<string, string>();
  const existing = await prisma.category.findMany({
    where: {
      OR: [
        { environmentId },
        { slug: { in: [...nodes.values()].map((n) => n.slug) } },
      ],
    },
    select: { id: true, slug: true, googlePath: true },
  });
  for (const cat of existing) {
    if (cat.googlePath) cache.set(cat.googlePath, cat.id);
    cache.set(`slug:${cat.slug}`, cat.id);
  }

  const maxDepth = Math.max(0, ...[...nodes.values()].map((n) => n.depth));
  for (let depth = 0; depth <= maxDepth; depth++) {
    const missing = [...nodes.values()].filter((node) => {
      if (node.depth !== depth) return false;
      return !(cache.get(node.pathKey) || cache.get(`slug:${node.slug}`));
    });
    if (missing.length === 0) continue;

    await prisma.category.createMany({
      data: missing.map((node) => ({
        id: newId(),
        name: node.name,
        slug: node.slug,
        parentId: node.parentPath
          ? cache.get(node.parentPath) || cache.get(`slug:${nodes.get(node.parentPath!)!.slug}`) || null
          : null,
        googlePath: node.pathKey,
        sortOrder: node.depth,
        environmentId,
      })),
      skipDuplicates: true,
    });

    const created = await prisma.category.findMany({
      where: { slug: { in: missing.map((m) => m.slug) } },
      select: { id: true, slug: true, googlePath: true },
    });
    for (const cat of created) {
      if (cat.googlePath) cache.set(cat.googlePath, cat.id);
      cache.set(`slug:${cat.slug}`, cat.id);
    }
  }

  const result = new Map<string, { rootId: string; leafId: string }>();
  for (let i = 0; i < rows.length; i++) {
    const segments = rowPaths[i]!;
    if (segments.length === 0) {
      result.set(rows[i]!.id, { rootId: "", leafId: "" });
      continue;
    }
    const rootKey = segments[0]!;
    const leafKey = segments.join(" > ");
    const rootId =
      cache.get(rootKey) ||
      cache.get(`slug:${createCategorySlug(`${environmentSlug}-${rootKey}`)}`) ||
      "";
    const leafId =
      cache.get(leafKey) ||
      cache.get(`slug:${createCategorySlug(`${environmentSlug}-${leafKey}`)}`) ||
      rootId;
    result.set(rows[i]!.id, { rootId, leafId });
  }
  return result;
}

async function deleteRelatedForProducts(productDbIds: string[]) {
  if (productDbIds.length === 0) return;
  // Chunk ANY() deletes to keep payloads modest.
  const size = 500;
  for (let i = 0; i < productDbIds.length; i += size) {
    const chunk = productDbIds.slice(i, i + size);
    await prisma.$executeRawUnsafe(
      `DELETE FROM "catalog"."ProductImage" WHERE "productId" = ANY($1::text[])`,
      chunk
    );
    await prisma.$executeRawUnsafe(
      `DELETE FROM "catalog"."ProductVideo" WHERE "productId" = ANY($1::text[])`,
      chunk
    );
    await prisma.$executeRawUnsafe(
      `DELETE FROM "catalog"."Price" WHERE "productId" = ANY($1::text[])`,
      chunk
    );
    await prisma.$executeRawUnsafe(
      `DELETE FROM "catalog"."ProductTag" WHERE "productId" = ANY($1::text[])`,
      chunk
    );
  }
}

async function bulkUpdateProducts(
  rows: Array<{
    id: string;
    sku: string;
    itemNo: number | null;
    name: string;
    slug: string;
    description: string;
    shortDescription: string;
    categoryId: string | null;
    subcategoryId: string | null;
    brandId: string | null;
    environmentId: string;
    condition: string;
    googleCategory: string | null;
    fbCategory: string | null;
    departmentSource: string;
    variantGroupKey: string | null;
    variantLabel: string | null;
    isVariantPrimary: boolean;
    gtin: string | null;
  }>
) {
  if (rows.length === 0) return;
  const size = 200;
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    await prisma.$executeRawUnsafe(
      `
      UPDATE "catalog"."Product" AS p SET
        "sku" = v.sku,
        "itemNo" = v.item_no,
        "name" = v.name,
        "slug" = v.slug,
        "description" = v.description,
        "shortDescription" = v.short_description,
        "categoryId" = NULLIF(v.category_id, ''),
        "subcategoryId" = NULLIF(v.subcategory_id, ''),
        "brandId" = NULLIF(v.brand_id, ''),
        "environmentId" = v.environment_id,
        "status" = 'ACTIVE'::"catalog"."ProductStatus",
        "deletedAt" = NULL,
        "condition" = v.condition,
        "googleCategory" = v.google_category,
        "fbCategory" = v.fb_category,
        "departmentSource" = v.department_source,
        "variantGroupKey" = v.variant_group_key,
        "variantLabel" = v.variant_label,
        "isVariantPrimary" = v.is_variant_primary,
        "gtin" = v.gtin,
        "updatedAt" = NOW()
      FROM unnest(
        $1::text[], $2::text[], $3::int[], $4::text[], $5::text[],
        $6::text[], $7::text[], $8::text[], $9::text[], $10::text[],
        $11::text[], $12::text[], $13::text[], $14::text[], $15::text[],
        $16::text[], $17::text[], $18::boolean[], $19::text[]
      ) AS v(
        id, sku, item_no, name, slug,
        description, short_description, category_id, subcategory_id, brand_id,
        environment_id, condition, google_category, fb_category, department_source,
        variant_group_key, variant_label, is_variant_primary, gtin
      )
      WHERE p.id = v.id
      `,
      chunk.map((r) => r.id),
      chunk.map((r) => r.sku),
      chunk.map((r) => r.itemNo),
      chunk.map((r) => r.name),
      chunk.map((r) => r.slug),
      chunk.map((r) => r.description),
      chunk.map((r) => r.shortDescription),
      chunk.map((r) => r.categoryId ?? ""),
      chunk.map((r) => r.subcategoryId ?? ""),
      chunk.map((r) => r.brandId ?? ""),
      chunk.map((r) => r.environmentId),
      chunk.map((r) => r.condition),
      chunk.map((r) => r.googleCategory ?? ""),
      chunk.map((r) => r.fbCategory ?? ""),
      chunk.map((r) => r.departmentSource),
      chunk.map((r) => r.variantGroupKey ?? ""),
      chunk.map((r) => r.variantLabel ?? ""),
      chunk.map((r) => r.isVariantPrimary),
      chunk.map((r) => r.gtin ?? "")
    );
  }
}

async function bulkUpsertInventory(
  rows: Array<{ productId: string; quantity: number; isInStock: boolean }>
) {
  if (rows.length === 0) return;
  const size = 500;
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO "catalog"."Inventory" ("id", "productId", "quantity", "isInStock", "updatedAt")
      SELECT v.id, v.product_id, v.quantity, v.is_in_stock, NOW()
      FROM unnest($1::text[], $2::text[], $3::int[], $4::boolean[]) AS v(id, product_id, quantity, is_in_stock)
      ON CONFLICT ("productId") DO UPDATE SET
        "quantity" = EXCLUDED."quantity",
        "isInStock" = EXCLUDED."isInStock",
        "updatedAt" = NOW()
      `,
      chunk.map(() => newId()),
      chunk.map((r) => r.productId),
      chunk.map((r) => r.quantity),
      chunk.map((r) => r.isInStock)
    );
  }
}

/**
 * Bulk upsert one batch of catalogue rows (creates + updates + related rows).
 * Designed for Neon Postgres — few round-trips, not one query per product.
 */
async function bulkUpsertCatalogueRows(
  rows: CatalogRow[],
  ctx: {
    environmentId: string;
    environmentSlug: string;
    department: string;
    variantIdentityById: Map<string, { groupKey: string | null; label: string | null }>;
    primaryIdByVariantGroup: Map<string, string>;
  }
): Promise<{ created: number; updated: number }> {
  if (rows.length === 0) return { created: 0, updated: 0 };

  const [brandBySlug, tagBySlug, categoryByRowId] = await Promise.all([
    ensureBrands(rows),
    ensureTags(rows),
    ensureCategoryTrees(rows, ctx.environmentId, ctx.environmentSlug),
  ]);

  const existing = await prisma.product.findMany({
    where: { productId: { in: rows.map((r) => r.id) } },
    select: { id: true, productId: true, environmentId: true },
  });
  for (const product of existing) {
    if (product.environmentId && product.environmentId !== ctx.environmentId) {
      throw new Error(`Product id ${product.productId} already belongs to another catalogue`);
    }
  }
  const existingByCode = new Map(existing.map((p) => [p.productId, p]));

  const toCreate = rows.filter((r) => !existingByCode.has(r.id));
  const toUpdate = rows.filter((r) => existingByCode.has(r.id));

  const idByCode = new Map<string, string>();
  for (const product of existing) idByCode.set(product.productId, product.id);

  if (toCreate.length > 0) {
    const createData = toCreate.map((row) => {
      const brandName = row.brand.trim() || "Unknown";
      const brandId = brandBySlug.get(createCategorySlug(brandName)) ?? null;
      const cats = categoryByRowId.get(row.id);
      const identity = ctx.variantIdentityById.get(row.id);
      const dbId = newId();
      idByCode.set(row.id, dbId);
      return {
        id: dbId,
        productId: row.id,
        sku: row.id,
        itemNo: row.item_no,
        name: row.title,
        slug: rowToProductSlug(row),
        description: row.description,
        shortDescription: row.description.slice(0, 200),
        categoryId: cats?.rootId || null,
        subcategoryId:
          cats?.leafId && cats.leafId !== cats.rootId ? cats.leafId : null,
        brandId,
        environmentId: ctx.environmentId,
        status: ProductStatus.ACTIVE,
        deletedAt: null,
        condition: row.condition,
        googleCategory: row.google_product_category || null,
        fbCategory: row.fb_product_category || null,
        departmentSource: ctx.department,
        variantGroupKey: identity?.groupKey ?? null,
        variantLabel: identity?.label ?? null,
        isVariantPrimary:
          !identity?.groupKey ||
          ctx.primaryIdByVariantGroup.get(identity.groupKey!) === row.id,
        gtin: row.gtin,
      };
    });

    // createMany in chunks (Neon payload limits)
    for (let i = 0; i < createData.length; i += 250) {
      await prisma.product.createMany({
        data: createData.slice(i, i + 250),
        skipDuplicates: true,
      });
    }

    // Re-resolve ids in case skipDuplicates skipped some
    const createdRows = await prisma.product.findMany({
      where: { productId: { in: toCreate.map((r) => r.id) } },
      select: { id: true, productId: true },
    });
    for (const row of createdRows) idByCode.set(row.productId, row.id);
  }

  if (toUpdate.length > 0) {
    await bulkUpdateProducts(
      toUpdate.map((row) => {
        const brandName = row.brand.trim() || "Unknown";
        const brandId = brandBySlug.get(createCategorySlug(brandName)) ?? null;
        const cats = categoryByRowId.get(row.id);
        const identity = ctx.variantIdentityById.get(row.id);
        return {
          id: idByCode.get(row.id)!,
          sku: row.id,
          itemNo: row.item_no,
          name: row.title,
          slug: rowToProductSlug(row),
          description: row.description,
          shortDescription: row.description.slice(0, 200),
          categoryId: cats?.rootId || null,
          subcategoryId:
            cats?.leafId && cats.leafId !== cats.rootId ? cats.leafId : null,
          brandId,
          environmentId: ctx.environmentId,
          condition: row.condition,
          googleCategory: row.google_product_category || null,
          fbCategory: row.fb_product_category || null,
          departmentSource: ctx.department,
          variantGroupKey: identity?.groupKey ?? null,
          variantLabel: identity?.label ?? null,
          isVariantPrimary:
            !identity?.groupKey ||
            ctx.primaryIdByVariantGroup.get(identity.groupKey!) === row.id,
          gtin: row.gtin,
        };
      })
    );
  }

  const allDbIds = rows
    .map((row) => idByCode.get(row.id))
    .filter((id): id is string => Boolean(id));

  await deleteRelatedForProducts(allDbIds);

  const imageRows: Array<{
    id: string;
    productId: string;
    url: string;
    isPrimary: boolean;
    sortOrder: number;
    altText: string;
  }> = [];
  const videoRows: Array<{
    id: string;
    productId: string;
    url: string;
    tag: string | null;
  }> = [];
  const priceRows: Array<{
    id: string;
    productId: string;
    amount: number;
    currency: string;
    type: "REGULAR" | "SALE";
    saleStart: Date | null;
    saleEnd: Date | null;
  }> = [];
  const tagRows: Array<{ productId: string; tagId: string }> = [];
  const inventoryRows: Array<{
    productId: string;
    quantity: number;
    isInStock: boolean;
  }> = [];

  for (const row of rows) {
    const productId = idByCode.get(row.id);
    if (!productId) continue;

    const images = rowImages(row);
    images.forEach((url, index) => {
      imageRows.push({
        id: newId(),
        productId,
        url,
        isPrimary: index === 0,
        sortOrder: index,
        altText: row.title,
      });
    });

    if (row.video_url?.startsWith("http")) {
      videoRows.push({
        id: newId(),
        productId,
        url: row.video_url,
        tag: row.video_tag,
      });
    }

    const saleWindow = parseSaleWindow(row.sale_price_effective_date);
    priceRows.push({
      id: newId(),
      productId,
      amount: row.price,
      currency: "QAR",
      type: "REGULAR",
      saleStart: null,
      saleEnd: null,
    });
    if (row.sale_price != null) {
      priceRows.push({
        id: newId(),
        productId,
        amount: row.sale_price,
        currency: "QAR",
        type: "SALE",
        saleStart: saleWindow.saleStart,
        saleEnd: saleWindow.saleEnd,
      });
    }

    for (const tagName of row.product_tags) {
      const name = tagName.trim();
      if (!name) continue;
      const tagId = tagBySlug.get(createCategorySlug(name));
      if (tagId) tagRows.push({ productId, tagId });
    }

    const qty = row.quantity_to_sell_on_facebook ?? 10;
    const isInStock = qty > 0 && row.availability.toLowerCase().includes("in stock");
    inventoryRows.push({ productId, quantity: qty, isInStock });
  }

  for (let i = 0; i < imageRows.length; i += 500) {
    await prisma.productImage.createMany({ data: imageRows.slice(i, i + 500) });
  }
  for (let i = 0; i < videoRows.length; i += 500) {
    await prisma.productVideo.createMany({ data: videoRows.slice(i, i + 500) });
  }
  for (let i = 0; i < priceRows.length; i += 500) {
    await prisma.price.createMany({ data: priceRows.slice(i, i + 500) });
  }
  for (let i = 0; i < tagRows.length; i += 500) {
    await prisma.productTag.createMany({
      data: tagRows.slice(i, i + 500),
      skipDuplicates: true,
    });
  }
  await bulkUpsertInventory(inventoryRows);

  return { created: toCreate.length, updated: toUpdate.length };
}

export async function startChunkedCatalogueImport(options: {
  buffer: Buffer;
  fileName: string;
  department: string;
  environmentId: string;
  environmentSlug: string;
  userId?: string;
  mode: "merge" | "replace";
}) {
  await waitForDbReady();
  await failStaleImports(options.environmentId);

  const active = await prisma.importJob.findFirst({
    where: { environmentId: options.environmentId, status: "IMPORTING" },
    select: { id: true, createdAt: true },
  });
  if (active) {
    throw new Error(
      "A catalogue import is already in progress for this catalogue. Wait for it to finish or try again in a few minutes."
    );
  }

  const parsed = await parseExcelBufferAsync(options.buffer, options.department);
  if (parsed.errors.length > 0 || parsed.rows.length === 0) {
    throw new Error(
      parsed.errors[0]?.message || "No valid product rows were found"
    );
  }

  const job = await prisma.importJob.create({
    data: {
      fileName: options.fileName,
      status: "IMPORTING",
      totalRows: parsed.rows.length,
      validRows: parsed.rows.length,
      invalidRows: 0,
      userId: options.userId,
      environmentId: options.environmentId,
      stats: JSON.stringify({
        mode: options.mode,
        offset: 0,
        created: 0,
        updated: 0,
        archived: 0,
      } satisfies JobStats),
    },
  });

  await mkdir(importDir(), { recursive: true });
  const payload: StoredImportPayload = {
    mode: options.mode,
    environmentId: options.environmentId,
    environmentSlug: options.environmentSlug,
    department: options.department,
    userId: options.userId,
    fileName: options.fileName,
    whatsappNumber: parsed.whatsappNumber,
    rows: parsed.rows,
  };
  await writeFile(payloadPath(job.id), JSON.stringify(payload), "utf8");

  await prisma.importJob.update({
    where: { id: job.id },
    data: {
      stats: JSON.stringify({
        mode: options.mode,
        offset: 0,
        created: 0,
        updated: 0,
        archived: 0,
        fileKey: job.id,
      } satisfies JobStats),
    },
  });

  return processCatalogueImportChunk(job.id);
}

export async function processCatalogueImportChunk(jobId: string) {
  await waitForDbReady();

  const job = await prisma.importJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== "IMPORTING") {
    throw new Error("Import job not found or already finished");
  }

  const stats = JSON.parse(job.stats || "{}") as JobStats;
  let offset = stats.offset ?? 0;

  let payload: StoredImportPayload;
  try {
    payload = JSON.parse(await readFile(payloadPath(jobId), "utf8")) as StoredImportPayload;
  } catch {
    await prisma.importJob.update({
      where: { id: jobId },
      data: { status: "FAILED", failed: 1, completedAt: new Date() },
    });
    throw new Error("Import payload missing — start the Excel upload again");
  }

  const { variantIdentityById, primaryIdByVariantGroup } = buildVariantMaps(
    payload.rows
  );

  let created = stats.created ?? 0;
  let updated = stats.updated ?? 0;
  const startedAt = Date.now();
  const requestStartOffset = offset;

  while (offset < payload.rows.length) {
    if (
      offset > requestStartOffset &&
      Date.now() - startedAt >= REQUEST_BUDGET_MS
    ) {
      break;
    }

    const batch = payload.rows.slice(offset, offset + BULK_BATCH_SIZE);
    const result = await bulkUpsertCatalogueRows(batch, {
      environmentId: payload.environmentId,
      environmentSlug: payload.environmentSlug,
      department: payload.department,
      variantIdentityById,
      primaryIdByVariantGroup,
    });
    created += result.created;
    updated += result.updated;
    offset += batch.length;

    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        created,
        updated,
        stats: JSON.stringify({
          ...stats,
          offset,
          created,
          updated,
        } satisfies JobStats),
      },
    });
  }

  const done = offset >= payload.rows.length;

  if (!done) {
    return {
      jobId,
      continue: true as const,
      progress: offset,
      totalRows: payload.rows.length,
      created,
      updated,
      archived: 0,
      mode: payload.mode,
      applied: false,
      canImport: true,
      errors: [] as Array<{ row: number; message: string }>,
      message: `Saved ${offset} of ${payload.rows.length} products…`,
    };
  }

  let archived = 0;
  const importedIds = payload.rows.map((r) => r.id);

  await prisma.$transaction(
    async (tx) => {
      if (payload.mode === "replace") {
        const archivedResult = await tx.product.updateMany({
          where: {
            environmentId: payload.environmentId,
            productId: { notIn: importedIds },
            deletedAt: null,
          },
          data: { status: ProductStatus.ARCHIVED, deletedAt: new Date() },
        });
        archived = archivedResult.count;
      }

      if (payload.whatsappNumber) {
        const wa = await tx.whatsAppSetting.findFirst();
        if (wa) {
          await tx.whatsAppSetting.update({
            where: { id: wa.id },
            data: { phoneNumber: payload.whatsappNumber },
          });
        } else {
          await tx.whatsAppSetting.create({
            data: { phoneNumber: payload.whatsappNumber },
          });
        }
      }
    },
    { maxWait: 15_000, timeout: 60_000 }
  );

  await updateCatalogue(payload.environmentId, { status: "ACTIVE" }, payload.userId);
  // Shop categories only — storefront cache refresh is deferred to the API route
  // `after()` so the import HTTP response returns as soon as rows are committed.
  await generateShopCategories(payload.environmentId, payload.environmentSlug);

  await prisma.importJob.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      created,
      updated,
      failed: 0,
      stats: JSON.stringify({
        ...stats,
        offset,
        created,
        updated,
        archived,
      } satisfies JobStats),
      completedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: payload.userId,
      action: "IMPORT",
      resource: "Product",
      resourceId: payload.environmentId,
      newValue: JSON.stringify({
        created,
        updated,
        archived,
        mode: payload.mode,
        fileName: payload.fileName,
      }),
    },
  });

  try {
    await unlink(payloadPath(jobId));
  } catch {
    /* ignore */
  }

  return {
    jobId,
    continue: false as const,
    progress: payload.rows.length,
    totalRows: payload.rows.length,
    validRows: payload.rows.length,
    invalidRows: 0,
    created,
    updated,
    archived,
    mode: payload.mode,
    failed: 0,
    applied: true,
    canImport: true,
    errors: [] as Array<{ row: number; message: string }>,
    message:
      `Done — ${created} created, ${updated} updated` +
      (archived ? `, ${archived} archived` : ""),
  };
}
