import fs from "fs";
import path from "path";

/** Sibling folder that survives Hostinger app-directory redeploys. */
export function persistentDataDir(cwd = process.cwd()): string {
  const fromEnv = process.env.TFRC_DATA_DIR?.trim();
  if (fromEnv) {
    return path.isAbsolute(fromEnv) ? fromEnv : path.join(cwd, fromEnv);
  }
  return path.join(cwd, "..", "tfrc-persistent");
}

export function persistentDbPath(cwd = process.cwd()): string {
  return path.join(persistentDataDir(cwd), "prod.db");
}

/** All known SQLite locations used across build, Hostinger, and standalone output. */
export function candidateSqlitePaths(preferredRelative = "prod.db"): string[] {
  const cwd = process.cwd();
  const cleaned = preferredRelative.replace(/^\.\//, "");
  const basename = path.basename(cleaned);
  const preferred = path.isAbsolute(cleaned) ? cleaned : path.join(cwd, cleaned);

  return [
    persistentDbPath(cwd),
    preferred,
    path.join(cwd, basename),
    path.join(cwd, "prisma", basename),
    path.join(cwd, ".next", basename),
    path.join(cwd, ".next", "standalone", basename),
    path.join(cwd, ".next", "standalone", "prisma", basename),
    path.join(cwd, "..", basename),
    path.join(cwd, "..", "prisma", basename),
    path.join("/tmp", `vitanova-${basename}`),
    path.join("/tmp", "vitanova-db", basename),
  ];
}

export function sqlitePathFromUrl(url: string | undefined): string | null {
  if (!url?.startsWith("file:")) return null;
  const filePath = url.replace(/^file:/, "");
  return path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath.replace(/^\.\//, ""));
}

/**
 * Prefer the richest DB (size), not newest mtime.
 * A freshly deployed seed has a new timestamp but must never beat owner data.
 */
export function pickNewestSqlitePath(preferredRelative = "prod.db"): string | null {
  const seen = new Set<string>();
  let best: { path: string; mtimeMs: number; size: number } | null = null;

  for (const candidate of candidateSqlitePaths(preferredRelative)) {
    const resolved = path.resolve(candidate);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    try {
      if (!fs.existsSync(resolved)) continue;
      const stat = fs.statSync(resolved);
      if (stat.size < 1000) continue;
      if (
        !best ||
        stat.size > best.size ||
        (stat.size === best.size && stat.mtimeMs > best.mtimeMs)
      ) {
        best = { path: resolved, mtimeMs: stat.mtimeMs, size: stat.size };
      }
    } catch {
      /* ignore */
    }
  }

  return best?.path ?? null;
}

/** Full fan-out copy (expensive). Prefer syncSqliteFileToEssentialReplicas for hot paths. */
export function syncSqliteFileToReplicas(sourcePath: string): string[] {
  const synced: string[] = [];
  const source = path.resolve(sourcePath);
  if (!fs.existsSync(source)) return synced;

  // Never clone a local development database over production seed/runtime copies.
  if (path.basename(source).toLowerCase() === "dev.db") {
    return synced;
  }

  const seen = new Set<string>([source]);
  for (const candidate of candidateSqlitePaths(path.basename(source))) {
    const dest = path.resolve(candidate);
    if (seen.has(dest)) continue;
    seen.add(dest);
    try {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      // Never shrink a richer replica with a smaller source.
      if (fs.existsSync(dest) && fs.statSync(dest).size > fs.statSync(source).size) {
        continue;
      }
      const temporary = `${dest}.${process.pid}.tmp`;
      fs.copyFileSync(source, temporary);
      fs.renameSync(temporary, dest);
      synced.push(dest);
    } catch (error) {
      console.warn(`[sqlite] Could not sync replica ${dest}:`, error);
    }
  }
  return synced;
}

/**
 * Copy only the Hostinger-critical DB locations. Avoids blocking the app while
 * cloning prod.db to every historical candidate path on every admin save.
 */
export function syncSqliteFileToEssentialReplicas(sourcePath: string): string[] {
  const synced: string[] = [];
  const source = path.resolve(sourcePath);
  if (!fs.existsSync(source)) return synced;
  if (path.basename(source).toLowerCase() === "dev.db") return synced;

  const cwd = process.cwd();
  const basename = path.basename(source);
  const essentials = [
    persistentDbPath(cwd),
    path.join(cwd, "prisma", basename),
    path.join(cwd, ".next", "standalone", "prisma", basename),
    path.join(cwd, ".next", "standalone", basename),
  ];

  const seen = new Set<string>([source]);
  for (const candidate of essentials) {
    const dest = path.resolve(candidate);
    if (seen.has(dest)) continue;
    seen.add(dest);
    try {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      if (fs.existsSync(dest) && fs.statSync(dest).size > fs.statSync(source).size) {
        continue;
      }
      const temporary = `${dest}.${process.pid}.tmp`;
      fs.copyFileSync(source, temporary);
      fs.renameSync(temporary, dest);
      synced.push(dest);
    } catch (error) {
      console.warn(`[sqlite] Could not sync essential replica ${dest}:`, error);
    }
  }
  return synced;
}
