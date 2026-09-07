import prisma from "@/lib/db";
import { parseExcelBuffer } from "@/lib/import/catalog-parser";
import {
  createCategorySlug,
  rowToProductSlug,
  rowImages,
  rowCategorySegments,
} from "@/lib/import/catalog-parser";
import { Prisma, ProductStatus } from "@prisma/client";
import { generateShopCategories } from "@/services/catalogue-admin.service";
import { persistRuntimeCatalogueData } from "@/lib/persist-runtime-data.server";
import { deriveProductVariantIdentity } from "@/lib/product-variants";

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

export interface ImportCatalogueOptions {
  buffer: Buffer;
  fileName: string;
  department: string;
  environmentId: string;
  environmentSlug: string;
  userId?: string;
  preview?: boolean;
}

async function validateProductOwnership(
  rows: Array<{ id: string; rowNumber: number }>,
  environmentId: string
) {
  const conflicts = new Map<string, string>();
  for (let offset = 0; offset < rows.length; offset += 500) {
    const batchIds = rows.slice(offset, offset + 500).map((row) => row.id);
    const existing = await prisma.product.findMany({
      where: {
        productId: { in: batchIds },
        environmentId: { not: environmentId },
      },
      select: {
        productId: true,
        environment: { select: { name: true } },
      },
    });
    for (const product of existing) {
      conflicts.set(product.productId, product.environment?.name ?? "another catalogue");
    }
  }

  return rows
    .filter((row) => conflicts.has(row.id))
    .map((row) => ({
      row: row.rowNumber,
      message:
        `Product ID ${row.id} already exists in “${conflicts.get(row.id)}”. ` +
        "Product IDs must be unique across catalogues; remove this row or use a different ID.",
    }));
}

export async function importCatalogueExcel(options: ImportCatalogueOptions) {
  const { buffer, fileName, department, environmentId, environmentSlug, userId, preview } = options;
  const parsed = parseExcelBuffer(buffer, department);
  const ownershipErrors = await validateProductOwnership(parsed.rows, environmentId);
  const validationErrors = [...parsed.errors, ...ownershipErrors].sort((a, b) => a.row - b.row);
  const totalRows = parsed.rows.length + parsed.errors.length;
  const validRows = Math.max(0, parsed.rows.length - ownershipErrors.length);
  const invalidRows = validationErrors.length;
  const conflictingRows = new Set(ownershipErrors.map((error) => error.row));

  const job = await prisma.importJob.create({
    data: {
      fileName,
      status: preview ? "PREVIEW" : "IMPORTING",
      totalRows,
      validRows,
      invalidRows,
      userId,
      environmentId,
      errors: {
        create: validationErrors.map((e) => ({
          row: e.row,
          message: e.message,
          severity: "error",
        })),
      },
    },
  });

  if (preview) {
    return {
      jobId: job.id,
      totalRows,
      validRows,
      invalidRows,
      created: 0,
      updated: 0,
      failed: invalidRows,
      archived: 0,
      applied: false,
      canImport: validRows > 0 && invalidRows === 0,
      errors: validationErrors,
      preview: parsed.rows
        .filter((row) => !conflictingRows.has(row.rowNumber))
        .slice(0, 10),
    };
  }

  if (validRows === 0 || invalidRows > 0) {
    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        failed: invalidRows || 1,
        completedAt: new Date(),
      },
    });
    return {
      jobId: job.id,
      totalRows,
      validRows,
      invalidRows,
      created: 0,
      updated: 0,
      archived: 0,
      failed: invalidRows || 1,
      applied: false,
      canImport: false,
      errors:
        validationErrors.length > 0
          ? validationErrors
          : [{ row: 1, message: "No valid product rows were found" }],
    };
  }

  const cache = new Map<string, string>();
  const variantIdentityById = new Map(
    parsed.rows.map((row) => [
      row.id,
      deriveProductVariantIdentity({
        title: row.title,
        productId: row.id,
        size: row.size,
        itemGroupId: row.item_group_id,
      }),
    ])
  );
  const primaryIdByVariantGroup = new Map<string, string>();
  for (const row of parsed.rows) {
    const groupKey = variantIdentityById.get(row.id)?.groupKey;
    if (groupKey && !primaryIdByVariantGroup.has(groupKey)) {
      primaryIdByVariantGroup.set(groupKey, row.id);
    }
  }
  let created = 0;
  let updated = 0;
  let archived = 0;
  let currentRow = parsed.rows[0];

  try {
    await prisma.$transaction(
      async (tx) => {
        const importedProductIds: string[] = [];

        for (const row of parsed.rows) {
          currentRow = row;
          const segments = rowCategorySegments(row);
          const { rootId, leafId } = await upsertCategoryTree(
            tx,
            segments,
            cache,
            environmentId,
            environmentSlug
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

          const existing = await tx.product.findUnique({ where: { productId: row.id } });
          if (existing?.environmentId && existing.environmentId !== environmentId) {
            throw new Error(`Product id ${row.id} already belongs to another catalogue`);
          }
      const productData = {
        productId: row.id,
        sku: row.id,
        name: row.title,
        slug,
        description: row.description,
        shortDescription: row.description.slice(0, 200),
        categoryId: rootId,
        subcategoryId: leafId !== rootId ? leafId : null,
        brandId: brand.id,
        environmentId,
        status: ProductStatus.ACTIVE,
            deletedAt: null,
            condition: row.condition,
        googleCategory: row.google_product_category,
        fbCategory: row.fb_product_category,
        departmentSource: department,
        variantGroupKey: variantIdentityById.get(row.id)?.groupKey ?? null,
        variantLabel: variantIdentityById.get(row.id)?.label ?? null,
        isVariantPrimary:
          !variantIdentityById.get(row.id)?.groupKey ||
          primaryIdByVariantGroup.get(variantIdentityById.get(row.id)!.groupKey!) === row.id,
        gtin: row.gtin,
      };

      let productId: string;
      if (existing) {
            await tx.product.update({ where: { id: existing.id }, data: productData });
        productId = existing.id;
            await tx.productImage.deleteMany({ where: { productId } });
            await tx.productVideo.deleteMany({ where: { productId } });
            await tx.price.deleteMany({ where: { productId } });
            await tx.productTag.deleteMany({ where: { productId } });
        updated++;
      } else {
            const p = await tx.product.create({ data: productData });
        productId = p.id;
        created++;
      }
          importedProductIds.push(row.id);

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
              .map((tagName) => [createCategorySlug(tagName), tagName])
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
        }

        const archivedResult = await tx.product.updateMany({
          where: {
            environmentId,
            productId: { notIn: importedProductIds },
            deletedAt: null,
          },
          data: { status: ProductStatus.ARCHIVED, deletedAt: new Date() },
        });
        archived = archivedResult.count;

        // Atomic completeness guard: never commit a partial catalogue.
        const importedLiveCount = await tx.product.count({
          where: {
            environmentId,
            status: ProductStatus.ACTIVE,
            deletedAt: null,
          },
        });
        if (importedLiveCount !== parsed.rows.length) {
          throw new Error(
            `Import completeness check failed: Excel has ${parsed.rows.length} valid products, ` +
              `but ${importedLiveCount} would be live. Nothing was changed.`
          );
        }

        if (parsed.whatsappNumber) {
          const wa = await tx.whatsAppSetting.findFirst();
          if (wa) {
            await tx.whatsAppSetting.update({
              where: { id: wa.id },
              data: { phoneNumber: parsed.whatsappNumber },
            });
          } else {
            await tx.whatsAppSetting.create({
              data: { phoneNumber: parsed.whatsappNumber },
            });
          }
        }
      },
      { maxWait: 10_000, timeout: 120_000 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Product import failed";
    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        failed: 1,
        completedAt: new Date(),
        errors: {
          create: {
            row: currentRow?.rowNumber ?? 1,
            message,
            severity: "error",
          },
        },
      },
    });
    return {
      jobId: job.id,
      totalRows: parsed.rows.length,
      validRows: parsed.rows.length,
      invalidRows: 1,
      created: 0,
      updated: 0,
      archived: 0,
      failed: 1,
      applied: false,
      canImport: false,
      errors: [{ row: currentRow?.rowNumber ?? 1, message }],
    };
  }

  await generateShopCategories(environmentId, environmentSlug);
  try {
    await persistRuntimeCatalogueData();
  } catch (error) {
    console.error("[catalog-import] persist after import failed:", error);
  }

  await prisma.importJob.update({
    where: { id: job.id },
    data: {
      status: "COMPLETED",
      created,
      updated,
      failed: 0,
      stats: JSON.stringify({ archived }),
      completedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: "IMPORT",
      resource: "Product",
      resourceId: environmentId,
      newValue: JSON.stringify({ created, updated, archived, failed: 0, fileName }),
    },
  });

  return {
    jobId: job.id,
    totalRows,
    validRows,
    invalidRows,
    created,
    updated,
    archived,
    failed: 0,
    applied: true,
    canImport: true,
    errors: [],
  };
}
