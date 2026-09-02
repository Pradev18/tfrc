import prisma from "@/lib/db";
import { refreshCatalogCacheFromDatabase } from "@/lib/catalog-cache-refresh.server";
import { sqlitePathFromUrl, syncSqliteFileToReplicas } from "@/lib/sqlite-paths";

/**
 * After admin writes, force SQLite + catalogue cache onto every known path
 * so Hostinger workers and fallback reads cannot keep serving pre-import data.
 */
export async function persistRuntimeCatalogueData(): Promise<void> {
  try {
    await prisma.$queryRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE);");
  } catch (error) {
    console.warn("[persist] WAL checkpoint skipped:", error);
  }

  const active = sqlitePathFromUrl(process.env.DATABASE_URL);
  if (active) {
    const synced = syncSqliteFileToReplicas(active);
    if (synced.length) {
      console.log(`[persist] Synced SQLite to ${synced.length} replica(s)`);
    }
  }

  try {
    await refreshCatalogCacheFromDatabase();
  } catch (error) {
    console.error("[persist] Catalogue cache refresh failed:", error);
  }
}

export async function persistRuntimeCatalogueDataSafely(): Promise<void> {
  try {
    await persistRuntimeCatalogueData();
  } catch (error) {
    console.error("[persist] Runtime catalogue persist failed:", error);
  }
}
