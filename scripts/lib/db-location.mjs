/**
 * Shared SQLite location helpers for Hostinger build/start scripts.
 * Live owner data must survive deploys — never live only inside the git checkout.
 */
import fs from "fs";
import path from "path";

export function persistentDataDir(root) {
  const fromEnv = process.env.TFRC_DATA_DIR?.trim();
  if (fromEnv) {
    return path.isAbsolute(fromEnv) ? fromEnv : path.join(root, fromEnv);
  }
  // Sibling folder next to the app release — Hostinger redeploys usually wipe the
  // app directory but leave the parent domain folder intact.
  return path.join(root, "..", "tfrc-persistent");
}

export function persistentDbPath(root) {
  return path.join(persistentDataDir(root), "prod.db");
}

export function persistentCachePath(root) {
  return path.join(persistentDataDir(root), "catalog-cache.json");
}

export function seedDbPath(root) {
  const seed = path.join(root, "prisma", "seed-prod.db");
  if (fs.existsSync(seed) && fs.statSync(seed).size > 1000) return seed;
  const legacy = path.join(root, "prisma", "prod.db");
  if (fs.existsSync(legacy) && fs.statSync(legacy).size > 1000) return legacy;
  return null;
}

export function isSeedDatabasePath(root, filePath) {
  if (!filePath) return false;
  try {
    const resolved = path.resolve(filePath);
    const seed = path.resolve(root, "prisma", "seed-prod.db");
    if (resolved === seed) return true;
    // App-local prisma/prod.db is often a deploy-time seed copy — never treat it
    // as richer than the persistent owner database.
    const appProd = path.resolve(root, "prisma", "prod.db");
    const persistent = path.resolve(persistentDbPath(root));
    if (resolved === appProd && fs.existsSync(persistent)) {
      return fs.statSync(appProd).size <= fs.statSync(persistent).size;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Resolve DATABASE_URL file: paths relative to prisma/ (Prisma convention).
 * Returns absolute path or null.
 */
export function resolveDatabaseUrlPath(root, url = process.env.DATABASE_URL) {
  const raw = url?.trim();
  if (!raw || !raw.startsWith("file:")) return null;
  let file = raw.slice("file:".length);
  // Strip optional leading slashes used by some file: URLs on Windows.
  if (/^\/+[A-Za-z]:/.test(file)) file = file.replace(/^\/+/, "");
  if (path.isAbsolute(file)) return path.resolve(file);
  // Prisma resolves ./dev.db relative to the prisma directory.
  return path.resolve(root, "prisma", file.replace(/^\.\//, ""));
}

/**
 * Prefer the persistent owner DB, then DATABASE_URL, then richest non-seed candidate.
 * Never returns the shipped seed when a live owner DB exists.
 */
export function resolveLiveDbPath(root, preferred) {
  const persistent = persistentDbPath(root);
  if (fs.existsSync(persistent)) {
    try {
      const stat = fs.statSync(persistent);
      if (stat.size >= 1000) {
        return {
          path: persistent,
          size: stat.size,
          mtimeMs: stat.mtimeMs,
          source: "persistent",
        };
      }
    } catch {
      /* fall through */
    }
  }

  const fromEnv = resolveDatabaseUrlPath(root);
  if (fromEnv && fs.existsSync(fromEnv) && !isSeedDatabasePath(root, fromEnv)) {
    try {
      const stat = fs.statSync(fromEnv);
      if (stat.size >= 1000) {
        return {
          path: fromEnv,
          size: stat.size,
          mtimeMs: stat.mtimeMs,
          source: "DATABASE_URL",
        };
      }
    } catch {
      /* fall through */
    }
  }

  const best = pickBestDbPath(root, preferred);
  if (best && !isSeedDatabasePath(root, best.path)) {
    return { ...best, source: "richest-candidate" };
  }
  return null;
}

export function candidateDbPaths(root, preferred) {
  const basename = "prod.db";
  return [
    preferred,
    persistentDbPath(root),
    path.join(root, "prisma", basename),
    path.join(root, basename),
    path.join(root, ".next", basename),
    path.join(root, ".next", "standalone", basename),
    path.join(root, ".next", "standalone", "prisma", basename),
    path.join("/tmp", "vitanova-prod.db"),
    path.join("/tmp", "vitanova-db", "prod.db"),
  ].filter(Boolean);
}

/**
 * Prefer the richest existing DB (size), not the freshest mtime.
 * A just-deployed seed file has a new mtime but wipes owner catalogues.
 * Seed-prod.db is never selected here.
 */
export function pickBestDbPath(root, preferred) {
  let best = null;
  const seen = new Set();
  const seed = path.resolve(root, "prisma", "seed-prod.db");
  for (const candidate of candidateDbPaths(root, preferred)) {
    const resolved = path.resolve(candidate);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    if (resolved === seed) continue;
    try {
      if (!fs.existsSync(resolved)) continue;
      const stat = fs.statSync(resolved);
      if (stat.size < 1000) continue;
      if (
        !best ||
        stat.size > best.size ||
        (stat.size === best.size && stat.mtimeMs > best.mtimeMs)
      ) {
        best = { path: resolved, size: stat.size, mtimeMs: stat.mtimeMs };
      }
    } catch {
      /* ignore */
    }
  }
  return best;
}

export function canWriteDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, `.write-test-${process.pid}`);
    fs.writeFileSync(probe, "ok");
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

export function copyDbAtomic(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const temporary = `${dest}.${process.pid}.tmp`;
  fs.copyFileSync(src, temporary);
  fs.renameSync(temporary, dest);
}
