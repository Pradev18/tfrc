import path from "path";
import fs from "fs";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function candidateSqlitePaths(relativeOrAbsolute: string): string[] {
  const cleaned = relativeOrAbsolute.replace(/^\.\//, "");
  if (path.isAbsolute(cleaned)) return [cleaned];

  const cwd = process.cwd();
  return [
    path.join(cwd, cleaned),
    path.join(cwd, "prisma", "prod.db"),
    path.join(cwd, "..", "prisma", "prod.db"),
    path.join(cwd, "..", "..", "prisma", "prod.db"),
  ];
}

/** Resolve relative SQLite paths; fall back to bundled prod.db; copy to /tmp if needed. */
function getDatasourceUrl(): string | undefined {
  const url = process.env.DATABASE_URL ?? "file:./prisma/prod.db";
  if (!url.startsWith("file:")) return url;

  const filePath = url.replace(/^file:/, "");
  const candidates = candidateSqlitePaths(filePath);

  for (const absolute of candidates) {
    try {
      if (fs.existsSync(absolute) && fs.statSync(absolute).size > 1000) {
        process.env.DATABASE_URL = `file:${absolute}`;
        return `file:${absolute}`;
      }
    } catch {
      /* ignore */
    }
  }

  // Prefer creating/using a writable copy under /tmp on locked hosts
  const bundled = candidates.find((p) => {
    try {
      return fs.existsSync(p) && fs.statSync(p).size > 1000;
    } catch {
      return false;
    }
  });

  const tmpDb = path.join("/tmp", "vitanova-prod.db");
  try {
    if (bundled) {
      fs.copyFileSync(bundled, tmpDb);
      process.env.DATABASE_URL = `file:${tmpDb}`;
      return `file:${tmpDb}`;
    }
  } catch {
    /* ignore */
  }

  const fallback = path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath.replace(/^\.\//, ""));
  return `file:${fallback}`;
}

const datasourceUrl = getDatasourceUrl();

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    ...(datasourceUrl ? { datasources: { db: { url: datasourceUrl } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

globalForPrisma.prisma = prisma;

export default prisma;
