import { PrismaClient, ProductStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import path from "path";
import fs from "fs";
import {
  readCatalogFile,
  rowImages,
  rowCategorySegments,
  rowToProductSlug,
  createCategorySlug,
  CATALOG_FILES,
} from "@/lib/import/catalog-parser";
import { ENVIRONMENT_CONFIGS } from "@/lib/environments";

const prisma = new PrismaClient();

const categoryCache = new Map<string, string>();
const environmentIdByDept = new Map<string, string>();

async function seedEnvironments() {
  for (const [index, cfg] of ENVIRONMENT_CONFIGS.entries()) {
    const env = await prisma.environment.upsert({
      where: { slug: cfg.slug },
      create: {
        name: cfg.displayName,
        slug: cfg.slug,
        description: cfg.description,
        tagline: cfg.tagline,
        icon: cfg.icon,
        departmentSource: cfg.departmentSource,
        sortOrder: index,
        status: "ACTIVE",
        theme: JSON.stringify(cfg.theme),
        seo: JSON.stringify(cfg.seo),
        navigation: JSON.stringify([]),
        homepage: JSON.stringify({}),
        settings: JSON.stringify({}),
      },
      update: {
        name: cfg.displayName,
        description: cfg.description,
        tagline: cfg.tagline,
        icon: cfg.icon,
        departmentSource: cfg.departmentSource,
        sortOrder: index,
        theme: JSON.stringify(cfg.theme),
        seo: JSON.stringify(cfg.seo),
      },
    });
    environmentIdByDept.set(cfg.departmentSource, env.id);
  }
}

async function upsertCategoryTree(
  segments: string[],
  environmentId: string
): Promise<{
  rootId: string | null;
  leafId: string | null;
}> {
  if (segments.length === 0) return { rootId: null, leafId: null };

  let parentId: string | null = null;
  let rootId: string | null = null;
  let leafId: string | null = null;
  const fullPath: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const name = segments[i];
    fullPath.push(name);
    const pathKey = fullPath.join(" > ");
    const slug = createCategorySlug(pathKey);
    const cacheKey = `${environmentId}:${pathKey}`;

    let categoryId: string | undefined = categoryCache.get(cacheKey);
    if (!categoryId) {
      const existing = await prisma.category.findUnique({ where: { slug } });
      if (existing) {
        categoryId = existing.id;
        if (!existing.environmentId) {
          await prisma.category.update({
            where: { id: existing.id },
            data: { environmentId },
          });
        }
      } else {
        const newCategory = await prisma.category.create({
          data: {
            name,
            slug,
            parentId,
            googlePath: pathKey,
            environmentId,
            sortOrder: i,
            isActive: true,
          },
        });
        categoryId = newCategory.id;
      }
      categoryCache.set(cacheKey, categoryId);
    }

    if (i === 0) rootId = categoryId;
    leafId = categoryId;
    parentId = categoryId;
  }

  return { rootId, leafId };
}

async function upsertBrand(name: string): Promise<string> {
  const slug = createCategorySlug(name);
  const brand = await prisma.brand.upsert({
    where: { slug },
    create: { name, slug, isActive: true },
    update: { name, isActive: true },
  });
  return brand.id;
}

async function importRow(
  row: Awaited<ReturnType<typeof readCatalogFile>>["rows"][0],
  environmentId: string
): Promise<"created" | "updated"> {
  const segments = rowCategorySegments(row);
  const { rootId, leafId } = await upsertCategoryTree(segments, environmentId);
  const brandId = await upsertBrand(row.brand);
  const slug = rowToProductSlug(row);
  const images = rowImages(row);
  const isInStock = row.availability.toLowerCase().includes("in stock");
  const qty = row.quantity_to_sell_on_facebook ?? (isInStock ? 10 : 0);

  const existing = await prisma.product.findUnique({
    where: { productId: row.id },
  });

  const productData = {
    productId: row.id,
    sku: row.id,
    name: row.title,
    slug,
    shortDescription: row.description.slice(0, 200) || null,
    description: row.description || null,
    environmentId,
    categoryId: rootId,
    subcategoryId: leafId !== rootId ? leafId : null,
    brandId,
    status: ProductStatus.ACTIVE,
    condition: row.condition,
    gtin: row.gtin,
    googleCategory: row.google_product_category || null,
    fbCategory: row.fb_product_category || null,
    departmentSource: row.departmentSource,
    seoTitle: `${row.title} | TFRC Vita Nova`,
    seoDescription: row.description.slice(0, 160) || null,
    isNew: false,
    isFeatured: false,
    isBestseller: false,
  };

  let productId: string;

  if (existing) {
    await prisma.product.update({
      where: { id: existing.id },
      data: productData,
    });
    productId = existing.id;
    await prisma.productImage.deleteMany({ where: { productId } });
    await prisma.productVideo.deleteMany({ where: { productId } });
    await prisma.price.deleteMany({ where: { productId } });
  } else {
    const product = await prisma.product.create({ data: productData });
    productId = product.id;
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

  if (row.video_url && row.video_url.startsWith("http")) {
    await prisma.productVideo.create({
      data: {
        productId,
        url: row.video_url,
        tag: row.video_tag,
        sortOrder: 0,
      },
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
    create: {
      productId,
      quantity: qty,
      isInStock,
      lowStockThreshold: 3,
    },
    update: { quantity: qty, isInStock },
  });

  for (const tagName of row.product_tags) {
    const tagSlug = createCategorySlug(tagName);
    const tag = await prisma.tag.upsert({
      where: { slug: tagSlug },
      create: { name: tagName, slug: tagSlug },
      update: { name: tagName },
    });
    await prisma.productTag.upsert({
      where: { productId_tagId: { productId, tagId: tag.id } },
      create: { productId, tagId: tag.id },
      update: {},
    });
  }

  return existing ? "updated" : "created";
}

async function main() {
  console.log("🌱 Seeding TFRC Vita Nova database...\n");

  await prisma.inventoryTransaction.deleteMany();
  await prisma.productTag.deleteMany();
  await prisma.productVideo.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.priceHistory.deleteMany();
  await prisma.price.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.promotionProduct.deleteMany();
  await prisma.product.deleteMany();
  await prisma.homepageSection.deleteMany();
  await prisma.category.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.tag.deleteMany();
  categoryCache.clear();
  environmentIdByDept.clear();

  await seedEnvironments();

  const superRole = await prisma.role.upsert({
    where: { name: "SUPER_ADMIN" },
    create: { name: "SUPER_ADMIN", description: "Full system access" },
    update: {},
  });

  const adminRole = await prisma.role.upsert({
    where: { name: "ADMIN" },
    create: { name: "ADMIN", description: "Administrative access" },
    update: {},
  });

  const passwordHash = await bcrypt.hash("admin123", 12);
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@pawmart.qa" },
    create: {
      email: "admin@pawmart.qa",
      name: "PawMart Admin",
      passwordHash,
      isActive: true,
      roles: { create: [{ roleId: superRole.id }] },
    },
    update: { passwordHash },
  });

  let whatsappNumber = "97455049229";
  let created = 0;
  let updated = 0;
  let errors = 0;

  const rootDir = process.cwd();

  for (const file of CATALOG_FILES) {
    const filePath = path.join(rootDir, file.path);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠ File not found: ${filePath}`);
      continue;
    }

    console.log(`📂 Importing ${file.name}...`);
    const parsed = readCatalogFile(filePath, file.department);
    if (parsed.whatsappNumber) whatsappNumber = parsed.whatsappNumber;

    for (const row of parsed.rows) {
      try {
        const envId = environmentIdByDept.get(file.department);
        if (!envId) throw new Error(`No environment for department ${file.department}`);
        const result = await importRow(row, envId);
        if (result === "created") created++;
        else updated++;
      } catch (e) {
        errors++;
        console.error(`  ✗ ${row.id}: ${e instanceof Error ? e.message : e}`);
      }
    }

    console.log(`  ✓ ${parsed.rows.length} rows from ${file.name}`);
  }

  const existingWa = await prisma.whatsAppSetting.findFirst();
  if (existingWa) {
    await prisma.whatsAppSetting.update({
      where: { id: existingWa.id },
      data: { phoneNumber: whatsappNumber },
    });
  } else {
    await prisma.whatsAppSetting.create({
      data: {
        phoneNumber: whatsappNumber,
        defaultGreeting: "Hello, I would like to order from TFRC Vita Nova",
        productTemplate:
          "• {{name}}\n  Price: {{price}}\n  Ref: {{productId}}",
        isActive: true,
      },
    });
  }

  const settings = [
    { key: "site_name", value: "TFRC Vita Nova", group: "general" },
    { key: "site_tagline", value: "One Platform. Curated Catalogues.", group: "general" },
    { key: "site_description", value: "TFRC Vita Nova — premium catalogues for pets, home & living, and professional tools in Qatar. Order on WhatsApp.", group: "general" },
  ];

  for (const s of settings) {
    await prisma.siteSetting.upsert({
      where: { key: s.key },
      create: s,
      update: { value: s.value },
    });
  }

  const sectionTypes = [
    "hero",
    "categories",
    "featured_products",
    "offers",
    "why_us",
    "whatsapp_cta",
  ];

  for (const env of await prisma.environment.findMany()) {
    await prisma.homepageSection.createMany({
      data: sectionTypes.map((type, i) => ({
        type,
        title: type,
        environmentId: env.id,
        sortOrder: i,
        isEnabled: true,
      })),
    });
  }

  const { generateShopCategories } = await import("@/services/catalogue-admin.service");
  for (const env of await prisma.environment.findMany()) {
    const existing = await prisma.shopCategory.count({ where: { environmentId: env.id } });
    if (existing === 0) {
      await generateShopCategories(env.id, env.slug);
    }
  }

  const productCount = await prisma.product.count();
  const categoryCount = await prisma.category.count();

  console.log("\n✅ Seed complete!");
  console.log(`   Products: ${productCount} (${created} created, ${updated} updated, ${errors} errors)`);
  console.log(`   Categories: ${categoryCount}`);
  console.log(`   Admin: admin@pawmart.qa / admin123`);
  console.log(`   WhatsApp: ${whatsappNumber}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
