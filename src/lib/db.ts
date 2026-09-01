import path from "path";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

/** On Vercel, resolve bundled SQLite to an absolute path under project root. */
function getDatasourceUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("file:") || !process.env.VERCEL) return url;

  const filePath = url.replace(/^file:/, "");
  if (path.isAbsolute(filePath)) return url;

  const absolute = path.join(process.cwd(), filePath.replace(/^\.\//, ""));
  return `file:${absolute}`;
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
