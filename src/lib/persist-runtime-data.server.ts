import prisma from "@/lib/db";
import { refreshCatalogCacheFromDatabase } from "@/lib/catalog-cache-refresh.server";
import { sqlitePathFromUrl, syncSqliteFileToEssentialReplicas } from "@/lib/sqlite-paths";

/**
 * After admin catalogue writes, refresh cache + essential DB replicas.
 * Uses PASSIVE WAL checkpoint so storefront reads are not frozen (unlike TRUNCATE).
 */
export async function persistRuntimeCatalogueData(): Promise<void> {
  try {
    await prisma.$queryRawUnsafe("PRAGMA wal_checkpoint(PASSIVE);");
  } catch (error) {
    console.warn("[persist] WAL checkpoint skipped:", error);
  }

  const active = sqlitePathFromUrl(process.env.DATABASE_URL);
  if (active) {
    const synced = syncSqliteFileToEssentialReplicas(active);
    if (synced.length) {
      console.log(`[persist] Synced SQLite to ${synced.length} essential replica(s)`);
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
