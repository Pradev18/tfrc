/**
 * Resumable catalogue Excel import — one short HTTP request per chunk.
 * Survives Hostinger/Cloudflare ~100s gateway limits (400 → 10k+ rows).
 */
import { mkdir, writeFile, readFile, unlink } from "fs/promises";
import path from "path";
import prisma, { waitForDbReady } from "@/lib/db";
import { parseExcelBufferAsync } from "@/lib/import/catalog-parser";
import {
  createCategorySlug,
  rowToProductSlug,
  rowImages,
  rowCategorySegments,
  type CatalogRow,
} from "@/lib/import/catalog-parser";
import { Prisma, ProductStatus } from "@prisma/client";
import { generateShopCategories, updateCatalogue } from "@/services/catalogue-admin.service";
import { persistRuntimeCatalogueDataSafely } from "@/lib/persist-runtime-data.server";
import {
  classifyProductVariants,
  compareVariantLabels,
} from "@/lib/product-variants";
import { persistentUploadsDir } from "@/lib/sqlite-paths";

const CHUNK_SIZE = 30;

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

async function upsertCategoryTree(
  tx: Prisma.TransactionClient,
  segments: string[],
  cache: Map<string, string>,
  environmentId: string,
  environmentSlug: string
) {
  let parentId: string | null = null;
  let rootId: string | null = null;
  let leafId: string | null = null;
  const fullPath: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const name = segments[i];
    fullPath.push(name);
    const pathKey = fullPath.join(" > ");
    const slug = createCategorySlug(`${environmentSlug}-${pathKey}`);

    let categoryId: string | undefined = cache.get(pathKey);
    if (!categoryId) {
      const createdCategory: { id: string } = await tx.category.upsert({
        where: { slug },
        create: {
          name,
          slug,
          parentId,
          googlePath: pathKey,
          sortOrder: i,
          environmentId,
        },
        update: { name, parentId, googlePath: pathKey, environmentId },
      });
      categoryId = createdCategory.id;
      cache.set(pathKey, categoryId);
    }
    if (i === 0) rootId = categoryId;
    leafId = categoryId;
    parentId = categoryId;
  }
  return { rootId, leafId };
}

async function upsertOneRow(
  tx: Prisma.TransactionClient,
  row: CatalogRow,
  ctx: {
    environmentId: string;
    environmentSlug: string;
    department: string;
    cache: Map<string, string>;
    variantIdentityById: Map<
      string,
      { groupKey: string | null; label: string | null }
    >;
    primaryIdByVariantGroup: Map<string, string>;
  }
): Promise<"created" | "updated"> {
  const segments = rowCategorySegments(row);
  const { rootId, leafId } = await upsertCategoryTree(
    tx,
    segments,
    ctx.cache,
    ctx.environmentId,
    ctx.environmentSlug
  );
  const brandSlug = createCategorySlug(row.brand);
  const brand = await tx.brand.upsert({
    where: { slug: brandSlug },
    create: { name: row.brand, slug: brandSlug },
    update: { name: row.brand },
  });

  const slug = rowToProductSlug(row);
  const images = rowImages(row);
  const qty = row.quantity_to_sell_on_facebook ?? 10;
  const isInStock = qty > 0 && row.availability.toLowerCase().includes("in stock");
  const saleWindow = parseSaleWindow(row.sale_price_effective_date);
  const identity = ctx.variantIdentityById.get(row.id);

  const existing = await tx.product.findUnique({ where: { productId: row.id } });
  if (existing?.environmentId && existing.environmentId !== ctx.environmentId) {
    throw new Error(`Product id ${row.id} already belongs to another catalogue`);
  }

  const productData = {
    productId: row.id,
    sku: row.id,
    itemNo: row.item_no,
    name: row.title,
    slug,
    description: row.description,
    shortDescription: row.description.slice(0, 200),
    categoryId: rootId,
    subcategoryId: leafId !== rootId ? leafId : null,
    brandId: brand.id,
    environmentId: ctx.environmentId,
    status: ProductStatus.ACTIVE,
    deletedAt: null,
    condition: row.condition,
    googleCategory: row.google_product_category,
    fbCategory: row.fb_product_category,
    departmentSource: ctx.department,
    variantGroupKey: identity?.groupKey ?? null,
    variantLabel: identity?.label ?? null,
    isVariantPrimary:
      !identity?.groupKey ||
      ctx.primaryIdByVariantGroup.get(identity.groupKey!) === row.id,
    gtin: row.gtin,
  };

  let productId: string;
  let result: "created" | "updated";
  if (existing) {
    await tx.product.update({ where: { id: existing.id }, data: productData });
    productId = existing.id;
    await tx.productImage.deleteMany({ where: { productId } });
    await tx.productVideo.deleteMany({ where: { productId } });
    await tx.price.deleteMany({ where: { productId } });
    await tx.productTag.deleteMany({ where: { productId } });
    result = "updated";
  } else {
    const p = await tx.product.create({ data: productData });
    productId = p.id;
    result = "created";
  }

  if (images.length) {
    await tx.productImage.createMany({
      data: images.map((url, i) => ({
        productId,
        url,
        isPrimary: i === 0,
        sortOrder: i,
        altText: row.title,
      })),
    });
  }

  if (row.video_url?.startsWith("http")) {
    await tx.productVideo.create({
      data: { productId, url: row.video_url, tag: row.video_tag },
    });
  }

  await tx.price.createMany({
    data: [
      { productId, amount: row.price, currency: "QAR", type: "REGULAR" },
      ...(row.sale_price
        ? [
            {
              productId,
              amount: row.sale_price,
              currency: "QAR",
              type: "SALE" as const,
              saleStart: saleWindow.saleStart,
              saleEnd: saleWindow.saleEnd,
            },
          ]
        : []),
    ],
  });

  const tagsBySlug = new Map(
    row.product_tags
      .map((tag) => tag.trim())
      .filter(Boolean)
      .map((tagName) => [createCategorySlug(tagName), tagName] as const)
  );
  for (const [tagSlug, tagName] of tagsBySlug) {
    const tag = await tx.tag.upsert({
      where: { slug: tagSlug },
      create: { name: tagName, slug: tagSlug },
      update: { name: tagName },
    });
    await tx.productTag.create({ data: { productId, tagId: tag.id } });
  }

  await tx.inventory.upsert({
    where: { productId },
    create: { productId, quantity: qty, isInStock },
    update: { quantity: qty, isInStock },
  });

  return result;
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
  const offset = stats.offset ?? 0;

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
  const cache = new Map<string, string>();
  const batch = payload.rows.slice(offset, offset + CHUNK_SIZE);

  let created = stats.created ?? 0;
  let updated = stats.updated ?? 0;

  if (batch.length > 0) {
    await prisma.$transaction(
      async (tx) => {
        for (const row of batch) {
          const result = await upsertOneRow(tx, row, {
            environmentId: payload.environmentId,
            environmentSlug: payload.environmentSlug,
            department: payload.department,
            cache,
            variantIdentityById,
            primaryIdByVariantGroup,
          });
          if (result === "created") created += 1;
          else updated += 1;
        }
      },
      { maxWait: 20_000, timeout: 60_000 }
    );
  }

  const nextOffset = offset + batch.length;
  const done = nextOffset >= payload.rows.length;

  if (!done) {
    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        created,
        updated,
        stats: JSON.stringify({
          ...stats,
          offset: nextOffset,
          created,
          updated,
        } satisfies JobStats),
      },
    });

    return {
      jobId,
      continue: true as const,
      progress: nextOffset,
      totalRows: payload.rows.length,
      created,
      updated,
      archived: 0,
      mode: payload.mode,
      applied: false,
      canImport: true,
      errors: [] as Array<{ row: number; message: string }>,
      message: `Saved ${nextOffset} of ${payload.rows.length} products…`,
    };
  }

  // Finalise: replace archive + categories + cache
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
  // Excel google_product_category → shop filters / categories
  await generateShopCategories(payload.environmentId, payload.environmentSlug);
  await persistRuntimeCatalogueDataSafely();

  await prisma.importJob.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      created,
      updated,
      failed: 0,
      stats: JSON.stringify({
        ...stats,
        offset: nextOffset,
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
    message: `Done — ${created} created, ${updated} updated` +
      (archived ? `, ${archived} archived` : ""),
  };
}
