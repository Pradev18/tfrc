/**
 * Idempotent SQLite column adds for live Hostinger DBs that miss schema updates
 * when prisma db push ran against a different file than runtime.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function columnExists(table, column) {
  const rows = await prisma.$queryRawUnsafe(`PRAGMA table_info(${table})`);
  return rows.some((row) => row.name === column);
}

try {
  if (!(await columnExists("Product", "itemNo"))) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Product" ADD COLUMN "itemNo" INTEGER`
    );
    console.log("[db] Added Product.itemNo column");
  } else {
    console.log("[db] Product.itemNo already present");
  }

  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Product_environmentId_itemNo_idx" ON "Product"("environmentId", "itemNo")`
  );
} catch (error) {
  console.warn("[db] itemNo migration warning:", error?.message ?? error);
} finally {
  await prisma.$disconnect();
}
