import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const slug = process.argv[2] ?? "pawmart";
const env = await prisma.environment.findUnique({ where: { slug } });

const roots = await prisma.category.findMany({
  where: { environmentId: env?.id, parentId: null, isActive: true },
  include: {
    children: {
      where: { isActive: true },
      include: { _count: { select: { products: true, subProducts: true } } },
    },
    _count: { select: { products: true, subProducts: true } },
  },
});

console.log("Environment:", env?.name);
for (const r of roots) {
  console.log("\nROOT:", r.name, `(${r._count.products + r._count.subProducts})`);
  for (const c of r.children) {
    console.log("  -", c.name, `(${c._count.products + c._count.subProducts})`);
  }
}

const products = await prisma.product.findMany({
  where: { environmentId: env?.id, status: "ACTIVE" },
  select: {
    name: true,
    googleCategory: true,
    subcategory: { select: { name: true, slug: true } },
    category: { select: { name: true, slug: true } },
  },
  take: 20,
});

console.log("\nSample product names:");
for (const p of products) console.log("-", p.name, "|", p.subcategory?.name ?? p.category?.name);

await prisma.$disconnect();
