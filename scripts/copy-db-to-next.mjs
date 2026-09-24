/**
 * After `next build`, copy the LIVE SQLite DB + catalog cache into `.next`
 * so Hostinger still has product data at runtime.
 *
 * Never copies the shipped seed database into the deploy artifact.
 * Never overwrites a richer destination with a smaller/default source.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  copyDbAtomic,
  isSeedDatabasePath,
  persistentCachePath,
  resolveLiveDbPath,
} from "./lib/db-location.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`[copy-db] ${path.relative(root, dest)} (${fs.statSync(dest).size} bytes)`);
}

function copyDbIfRicher(src, dest) {
  try {
    if (fs.existsSync(dest)) {
      const destSize = fs.statSync(dest).size;
      const srcSize = fs.statSync(src).size;
      if (destSize > srcSize) {
        console.log(
          `[copy-db] keep richer ${path.relative(root, dest)} (${destSize} bytes) — skip smaller source`
        );
        return;
      }
    }
    copyDbAtomic(src, dest);
    console.log(`[copy-db] ${path.relative(root, dest)} (${fs.statSync(dest).size} bytes)`);
  } catch (err) {
    console.warn(`[copy-db] skip ${dest}:`, err.message);
  }
}

const live = resolveLiveDbPath(root);
if (!live?.path || isSeedDatabasePath(root, live.path)) {
  console.warn(
    "[copy-db] No LIVE owner database available — skipping DB copy so seed catalogues are not deployed."
  );
} else {
  console.log(`[copy-db] Using LIVE ${live.path} (${live.size} bytes) via ${live.source}`);
  const dbTargets = [
    path.join(root, ".next", "prod.db"),
    path.join(root, ".next", "standalone", "prod.db"),
    path.join(root, ".next", "standalone", "prisma", "prod.db"),
    path.join(root, "prisma", "prod.db"),
  ];
  for (const dest of dbTargets) {
    copyDbIfRicher(live.path, dest);
  }
}

const cacheCandidates = [
  persistentCachePath(root),
  path.join(root, "data", "catalog-cache.json"),
];
const cacheSrc = cacheCandidates.find((file) => fs.existsSync(file));
if (cacheSrc) {
  const cacheTargets = [
    path.join(root, ".next", "catalog-cache.json"),
    path.join(root, ".next", "standalone", "data", "catalog-cache.json"),
    path.join(root, ".next", "standalone", "catalog-cache.json"),
  ];
  for (const dest of cacheTargets) {
    try {
      copyFile(cacheSrc, dest);
    } catch (err) {
      console.warn(`[copy-db] skip ${dest}:`, err.message);
    }
  }
} else {
  console.warn("[copy-db] No catalog-cache.json to copy (runtime start will rebuild from live DB).");
}
