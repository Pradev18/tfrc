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

export function seedDbPath(root) {
  const seed = path.join(root, "prisma", "seed-prod.db");
  if (fs.existsSync(seed) && fs.statSync(seed).size > 1000) return seed;
  const legacy = path.join(root, "prisma", "prod.db");
  if (fs.existsSync(legacy) && fs.statSync(legacy).size > 1000) return legacy;
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
 */
export function pickBestDbPath(root, preferred) {
  let best = null;
  const seen = new Set();
  for (const candidate of candidateDbPaths(root, preferred)) {
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
