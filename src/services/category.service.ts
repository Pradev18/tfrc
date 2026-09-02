import prisma from "@/lib/db";
import { getEnvironmentIdBySlug } from "@/services/environment.service";

export async function getRootCategories(environmentSlug?: string) {
  const environmentId = environmentSlug
    ? await getEnvironmentIdBySlug(environmentSlug)
    : null;

  return prisma.category.findMany({
    where: {
      parentId: null,
      isActive: true,
      ...(environmentId ? { environmentId } : {}),
    },
    include: {
      children: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        include: {
          _count: { select: { products: true, subProducts: true } },
        },
      },
      _count: { select: { products: true, subProducts: true } },
    },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getCategoryBySlug(slug: string) {
  return prisma.category.findUnique({
    where: { slug, isActive: true },
    include: {
      parent: true,
      children: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        include: { _count: { select: { products: true, subProducts: true } } },
      },
      _count: { select: { products: true, subProducts: true } },
    },
  });
}

export async function getDepartmentCategories() {
  const departments = await prisma.product.groupBy({
    by: ["departmentSource"],
    where: { status: "ACTIVE", departmentSource: { not: null } },
    _count: { id: true },
  });

  const roots = await getRootCategories();

  return {
    departments: departments.map((d) => ({
      name: d.departmentSource!,
      count: d._count.id,
    })),
    roots,
  };
}

export async function getCategoryProductCount(categoryId: string): Promise<number> {
  const descendants = await prisma.category.findMany({
    where: {
      OR: [{ id: categoryId }, { parentId: categoryId }],
    },
    select: { id: true },
  });
  const ids = descendants.map((c) => c.id);
  return prisma.product.count({
    where: {
      status: "ACTIVE",
      OR: [{ categoryId: { in: ids } }, { subcategoryId: { in: ids } }],
    },
  });
}

export async function getAllCategories(environmentSlug?: string) {
  const environmentId = environmentSlug
    ? await getEnvironmentIdBySlug(environmentSlug)
    : null;

  return prisma.category.findMany({
    where: {
      isActive: true,
      ...(environmentId ? { environmentId } : {}),
    },
    include: {
      parent: true,
      _count: { select: { products: true, subProducts: true } },
    },
    orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function getCategoryBreadcrumb(slug: string) {
  const category = await getCategoryBySlug(slug);
  if (!category) return [];

  const trail: Array<{ name: string; slug: string }> = [];
  let currentId: string | null = category.id;

  while (currentId) {
    const cat: {
      id: string;
      name: string;
      slug: string;
      parentId: string | null;
    } | null = await prisma.category.findUnique({
      where: { id: currentId },
      select: { id: true, name: true, slug: true, parentId: true },
    });
    if (!cat) break;
    trail.unshift({ name: cat.name, slug: cat.slug });
    currentId = cat.parentId;
  }

  return trail;
}

/** First product image for a category (cover photo) */
export async function getCategoryCoverImage(categoryId: string): Promise<string | null> {
  const product = await prisma.product.findFirst({
    where: {
      status: "ACTIVE",
      OR: [{ categoryId }, { subcategoryId: categoryId }],
      images: { some: {} },
    },
    include: {
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
    },
    orderBy: { isFeatured: "desc" },
  });
  return product?.images[0]?.url ?? null;
}

/** Cover images for all root categories in an environment */
export async function getRootCategoryCovers(environmentSlug?: string): Promise<Record<string, string>> {
  const roots = await getRootCategories(environmentSlug);

  const covers: Record<string, string> = {};
  await Promise.all(
    roots.map(async (cat) => {
      const url = await getCategoryCoverImage(cat.id);
      if (url) covers[cat.slug] = url;
    })
  );
  return covers;
}

/** Hero collage for environment */
export async function getEnvironmentHeroImages(environmentSlug: string): Promise<string[]> {
  try {
    return await getEnvironmentShowcaseImages(environmentSlug, 4);
  } catch (error) {
    console.error("[categories] hero images failed:", error);
    const { getCachedEnvironment } = await import("@/lib/catalog-cache");
    const cached = getCachedEnvironment(environmentSlug);
    return (cached?.products ?? [])
      .map((p) => p.images[0]?.url)
      .filter(Boolean)
      .slice(0, 4) as string[];
  }
}

/** Multiple product images for marketing collages (always from Excel catalogue URLs) */
export async function getEnvironmentShowcaseImages(
  environmentSlug: string,
  limit = 8
): Promise<string[]> {
  const environmentId = await getEnvironmentIdBySlug(environmentSlug);
  if (!environmentId) return [];

  const products = await prisma.product.findMany({
    where: {
      environmentId,
      status: "ACTIVE",
      images: { some: {} },
    },
    include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
    take: limit,
    orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
  });

  return products.map((p) => p.images[0]?.url).filter(Boolean) as string[];
}

/** Cover images for each department source */
export async function getDepartmentCoverImages(): Promise<Record<string, string>> {
  const departments = ["Pet Products", "Households", "Multi Tools"];
  const covers: Record<string, string> = {};

  await Promise.all(
    departments.map(async (dept) => {
      const product = await prisma.product.findFirst({
        where: {
          departmentSource: dept,
          status: "ACTIVE",
          images: { some: {} },
        },
        include: {
          images: { orderBy: { sortOrder: "asc" }, take: 1 },
        },
        orderBy: { isFeatured: "desc" },
      });
      if (product?.images[0]?.url) {
        covers[dept] = product.images[0].url;
      }
    })
  );

  return covers;
}

/** Hero collage — one image per department */
export async function getHeroCollageImages(): Promise<string[]> {
  const covers = await getDepartmentCoverImages();
  return Object.values(covers).slice(0, 3);
}

export type NavCategory = {
  id: string;
  name: string;
  slug: string;
  children: Array<{
    id: string;
    name: string;
    slug: string;
    productCount: number;
  }>;
  productCount: number;
  coverImage: string | null;
};

export async function getNavCategories(environmentSlug?: string): Promise<NavCategory[]> {
  const roots = await getRootCategories(environmentSlug);

  return Promise.all(
    roots.map(async (cat) => {
      const coverImage = await getCategoryCoverImage(cat.id);
      return {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        productCount: 0,
        coverImage,
        children: cat.children.map((child) => ({
          id: child.id,
          name: child.name,
          slug: child.slug,
          productCount: 0,
        })),
      };
    })
  );
}
