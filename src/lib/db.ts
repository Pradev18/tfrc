import path from "path";
import fs from "fs";
import { PrismaClient } from "@prisma/client";
import {
  persistentDbPath,
  pickNewestSqlitePath,
  sqlitePathFromUrl,
} from "@/lib/sqlite-paths";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient;
  prismaReady?: Promise<void>;
};

/** Resolve relative SQLite paths; persistent owner DB always wins when present. */
function getDatasourceUrl(): string | undefined {
  const url = process.env.DATABASE_URL ?? "file:./prod.db";
  if (!url.startsWith("file:")) return url;

  const persistent = persistentDbPath();
  try {
    if (fs.existsSync(persistent) && fs.statSync(persistent).size >= 1000) {
      process.env.DATABASE_URL = `file:${persistent}`;
      return `file:${persistent}`;
    }
  } catch {
    /* continue */
  }

  const preferred = url.replace(/^file:/, "").replace(/^\.\//, "");
  const newest = pickNewestSqlitePath(preferred);
  if (newest) {
    process.env.DATABASE_URL = `file:${newest}`;
    return `file:${newest}`;
  }

  try {
    fs.mkdirSync(path.dirname(persistent), { recursive: true });
    const probe = path.join(path.dirname(persistent), `.write-test-${process.pid}`);
    fs.writeFileSync(probe, "ok");
    fs.unlinkSync(probe);
    process.env.DATABASE_URL = `file:${persistent}`;
    return `file:${persistent}`;
  } catch {
    /* continue */
  }

  const fallback = path.isAbsolute(preferred)
    ? preferred
    : path.join(process.cwd(), preferred);

  try {
    fs.mkdirSync(path.dirname(fallback), { recursive: true });
    const probe = path.join(path.dirname(fallback), `.write-test-${process.pid}`);
    fs.writeFileSync(probe, "ok");
    fs.unlinkSync(probe);
    process.env.DATABASE_URL = `file:${fallback}`;
    return `file:${fallback}`;
  } catch {
    // Avoid /tmp in production — that DB disappears on restart.
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[db] FATAL: cannot write persistent or app DB path in production"
      );
      throw new Error("Persistent SQLite path is not writable");
    }
    const tmpDb = path.join("/tmp", "vitanova-prod.db");
    process.env.DATABASE_URL = `file:${tmpDb}`;
    return `file:${tmpDb}`;
  }
}

const datasourceUrl = getDatasourceUrl();

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    ...(datasourceUrl ? { datasources: { db: { url: datasourceUrl } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

async function ensureSqlitePragmas() {
  const active = sqlitePathFromUrl(process.env.DATABASE_URL);
  if (!active) return;
  try {
    await prisma.$queryRawUnsafe("PRAGMA journal_mode=WAL;");
    await prisma.$queryRawUnsafe("PRAGMA synchronous=NORMAL;");
    await prisma.$queryRawUnsafe("PRAGMA busy_timeout=20000;");
    await prisma.$queryRawUnsafe("PRAGMA temp_store=MEMORY;");
    // Faster reads on Hostinger without waiting for a full DB rewrite.
    await prisma.$queryRawUnsafe("PRAGMA cache_size=-65536;"); // ~64MB
    await prisma.$queryRawUnsafe("PRAGMA mmap_size=134217728;"); // 128MB
    await prisma.$queryRawUnsafe("PRAGMA wal_autocheckpoint=2000;");
  } catch (error) {
    console.warn("[db] Could not apply SQLite pragmas:", error);
  }
}

/** Live DBs can lag schema after deploy — add missing Product columns safely. */
async function ensureProductSchema() {
  try {
    const cols = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      `PRAGMA table_info("Product")`
    );
    const names = new Set(cols.map((col) => col.name));
    if (!names.has("itemNo")) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "Product" ADD COLUMN "itemNo" INTEGER`
      );
      console.log("[db] Added missing Product.itemNo column at runtime");
    }
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "Product_environmentId_itemNo_idx" ON "Product"("environmentId", "itemNo")`
    );
  } catch (error) {
    console.warn("[db] Could not ensure Product.itemNo:", error);
  }
}

if (!globalForPrisma.prismaReady) {
  globalForPrisma.prismaReady = (async () => {
    await ensureSqlitePragmas();
    await ensureProductSchema();
  })();
}

globalForPrisma.prisma = prisma;

export default prisma;

export async function waitForDbReady() {
  await globalForPrisma.prismaReady;
}
