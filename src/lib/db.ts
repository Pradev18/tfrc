import path from "path";
import fs from "fs";
import { PrismaClient } from "@prisma/client";
import { pickNewestSqlitePath, sqlitePathFromUrl } from "@/lib/sqlite-paths";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient;
  prismaReady?: Promise<void>;
};

/** Resolve relative SQLite paths; prefer the newest usable DB copy. */
function getDatasourceUrl(): string | undefined {
  const url = process.env.DATABASE_URL ?? "file:./prod.db";
  if (!url.startsWith("file:")) return url;

  const preferred = url.replace(/^file:/, "").replace(/^\.\//, "");
  const newest = pickNewestSqlitePath(preferred);
  if (newest) {
    process.env.DATABASE_URL = `file:${newest}`;
    return `file:${newest}`;
  }

  const fallback = path.isAbsolute(preferred)
    ? preferred
    : path.join(process.cwd(), preferred);

  // Last resort: writable /tmp when app directory cannot keep a DB.
  try {
    fs.mkdirSync(path.dirname(fallback), { recursive: true });
    const probe = path.join(path.dirname(fallback), `.write-test-${process.pid}`);
    fs.writeFileSync(probe, "ok");
    fs.unlinkSync(probe);
    process.env.DATABASE_URL = `file:${fallback}`;
    return `file:${fallback}`;
  } catch {
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
    await prisma.$queryRawUnsafe("PRAGMA busy_timeout=15000;");
  } catch (error) {
    console.warn("[db] Could not apply SQLite pragmas:", error);
  }
}

if (!globalForPrisma.prismaReady) {
  globalForPrisma.prismaReady = ensureSqlitePragmas();
}

globalForPrisma.prisma = prisma;

export default prisma;
