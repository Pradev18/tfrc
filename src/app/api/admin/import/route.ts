import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { parseExcelBuffer } from "@/lib/import/catalog-parser";
import { createCategorySlug, rowToProductSlug, rowImages, rowCategorySegments } from "@/lib/import/catalog-parser";
import { ProductStatus } from "@prisma/client";

async function upsertCategoryTree(segments: string[], cache: Map<string, string>) {
  let parentId: string | null = null;
  let rootId: string | null = null;
  let leafId: string | null = null;
  const fullPath: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const name = segments[i];
    fullPath.push(name);
    const pathKey = fullPath.join(" > ");
    const slug = createCategorySlug(pathKey);

    let categoryId: string | undefined = cache.get(pathKey);
    if (!categoryId) {
      const createdCategory: { id: string } = await prisma.category.upsert({
        where: { slug },
        create: { name, slug, parentId, googlePath: pathKey, sortOrder: i },
        update: { name, parentId, googlePath: pathKey },
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

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const department = String(formData.get("department") ?? "Other");
  const preview = formData.get("preview") === "true";

  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = parseExcelBuffer(buffer, department);

  const job = await prisma.importJob.create({
    data: {
      fileName: file.name,
      status: preview ? "PREVIEW" : "IMPORTING",
      totalRows: parsed.rows.length + parsed.errors.length,
      validRows: parsed.rows.length,
      invalidRows: parsed.errors.length,
      userId: session.user?.id,
      errors: {
        create: parsed.errors.map((e) => ({
          row: e.row,
          message: e.message,
          severity: "error",
        })),
      },
    },
  });

  if (preview) {
    return NextResponse.json({
      totalRows: parsed.rows.length + parsed.errors.length,
      validRows: parsed.rows.length,
      invalidRows: parsed.errors.length,
      created: 0,
      updated: 0,
      failed: parsed.errors.length,
      errors: parsed.errors,
      preview: parsed.rows.slice(0, 10),
    });
  }

  const cache = new Map<string, string>();
  let created = 0;
  let updated = 0;
  let failed = parsed.errors.length;

  for (const row of parsed.rows) {
    try {
      const segments = rowCategorySegments(row);
      const { rootId, leafId } = await upsertCategoryTree(segments, cache);
      const brandSlug = createCategorySlug(row.brand);
      const brand = await prisma.brand.upsert({
        where: { slug: brandSlug },
        create: { name: row.brand, slug: brandSlug },
        update: { name: row.brand },
      });

      const slug = rowToProductSlug(row);
      const images = rowImages(row);
      const isInStock = row.availability.toLowerCase().includes("in stock");
      const qty = row.quantity_to_sell_on_facebook ?? 10;

      const existing = await prisma.product.findUnique({ where: { productId: row.id } });
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
        status: ProductStatus.ACTIVE,
        googleCategory: row.google_product_category,
        fbCategory: row.fb_product_category,
        departmentSource: department,
        gtin: row.gtin,
      };

      let productId: string;
      if (existing) {
        await prisma.product.update({ where: { id: existing.id }, data: productData });
        productId = existing.id;
        await prisma.productImage.deleteMany({ where: { productId } });
        await prisma.productVideo.deleteMany({ where: { productId } });
        await prisma.price.deleteMany({ where: { productId } });
        updated++;
      } else {
        const p = await prisma.product.create({ data: productData });
        productId = p.id;
        created++;
      }

      if (images.length) {
        await prisma.productImage.createMany({
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
        await prisma.productVideo.create({
          data: { productId, url: row.video_url, tag: row.video_tag },
        });
      }

      await prisma.price.createMany({
        data: [
          { productId, amount: row.price, currency: "QAR", type: "REGULAR" },
          ...(row.sale_price
            ? [{ productId, amount: row.sale_price, currency: "QAR", type: "SALE" as const }]
            : []),
        ],
      });

      await prisma.inventory.upsert({
        where: { productId },
        create: { productId, quantity: qty, isInStock },
        update: { quantity: qty, isInStock },
      });
    } catch {
      failed++;
    }
  }

  if (parsed.whatsappNumber) {
    const wa = await prisma.whatsAppSetting.findFirst();
    if (wa) {
      await prisma.whatsAppSetting.update({
        where: { id: wa.id },
        data: { phoneNumber: parsed.whatsappNumber },
      });
    }
  }

  await prisma.importJob.update({
    where: { id: job.id },
    data: {
      status: "COMPLETED",
      created,
      updated,
      failed,
      completedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user?.id,
      action: "IMPORT",
      resource: "Product",
      newValue: JSON.stringify({ created, updated, failed, fileName: file.name }),
    },
  });

  return NextResponse.json({
    totalRows: parsed.rows.length + parsed.errors.length,
    validRows: parsed.rows.length,
    invalidRows: parsed.errors.length,
    created,
    updated,
    failed,
    errors: parsed.errors,
  });
}
