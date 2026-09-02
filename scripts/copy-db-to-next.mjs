/**
 * After `next build`, copy SQLite DB + catalog cache into `.next`
 * so Hostinger (output directory = .next) still has product data at runtime.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`[copy-db] ${path.relative(root, dest)} (${fs.statSync(dest).size} bytes)`);
}

const dbSrc = path.join(root, "prisma", "prod.db");
if (!fs.existsSync(dbSrc) || fs.statSync(dbSrc).size < 1000) {
  console.error("[copy-db] prisma/prod.db missing or empty");
  process.exit(1);
}

const dbTargets = [
  path.join(root, ".next", "prod.db"),
  path.join(root, ".next", "standalone", "prod.db"),
  path.join(root, ".next", "standalone", "prisma", "prod.db"),
];

for (const dest of dbTargets) {
  try {
    copyFile(dbSrc, dest);
  } catch (err) {
    console.warn(`[copy-db] skip ${dest}:`, err.message);
  }
}

const cacheSrc = path.join(root, "data", "catalog-cache.json");
if (fs.existsSync(cacheSrc)) {
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
}
