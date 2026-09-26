/**
 * Deploy safety helpers — zero data loss for catalogues AND uploaded contents.
 *
 * Hard rule: if the persistent live DB already has owner data
 * (catalogues, products, images, videos, or a non-trivial DB size), it is LOCKED.
 * Seed / app copies must never replace it — even at 1000 catalogues with full Excel uploads.
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import {
  canWriteDir,
  copyDbAtomic,
  isSeedDatabasePath,
  persistentDataDir,
} from "./db-location.mjs";

const require = createRequire(import.meta.url);
const MAX_BACKUPS = 14;
/** DB larger than this with unreadable counts still counts as owner data. */
const SUBSTANTIAL_DB_BYTES = 50_000;

function toFileUrl(filePath) {
  return `file:${path.resolve(filePath).replace(/\\/g, "/")}`;
}

/**
 * Full live-content snapshot used for LIVE LOCK and post-deploy drop detection.
 * Returns null if the file cannot be opened at all.
 */
export async function measureLiveContentAsync(dbFile) {
  if (!dbFile || !fs.existsSync(dbFile) || fs.statSync(dbFile).size < 1000) {
    return null;
  }

  const sizeBytes = fs.statSync(dbFile).size;
  let PrismaClient;
  try {
    ({ PrismaClient } = require("@prisma/client"));
  } catch {
    return {
      catalogues: null,
      products: null,
      images: null,
      videos: null,
      sizeBytes,
      locked: sizeBytes >= SUBSTANTIAL_DB_BYTES,
      label: `size-only (${sizeBytes} bytes)`,
    };
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: toFileUrl(dbFile) } },
  });

  try {
    let catalogues = null;
    let products = null;
    let images = null;
    let videos = null;

    try {
      catalogues = await prisma.environment.count({ where: { status: "ACTIVE" } });
    } catch {
      try {
        catalogues = await prisma.environment.count();
      } catch {
        catalogues = null;
      }
    }

    try {
      products = await prisma.product.count({
        where: { status: "ACTIVE", deletedAt: null },
      });
    } catch {
      try {
        products = await prisma.product.count();
      } catch {
        products = null;
      }
    }

    try {
      images = await prisma.productImage.count();
    } catch {
      images = null;
    }

    try {
      videos = await prisma.productVideo.count();
    } catch {
      videos = null;
    }

    const locked =
      (catalogues != null && catalogues >= 1) ||
      (products != null && products >= 1) ||
      (images != null && images >= 1) ||
      (videos != null && videos >= 1) ||
      (catalogues == null &&
        products == null &&
        images == null &&
        sizeBytes >= SUBSTANTIAL_DB_BYTES);

    const label = [
      catalogues != null ? `${catalogues} catalogue(s)` : null,
      products != null ? `${products} product(s)` : null,
      images != null ? `${images} image(s)` : null,
      videos != null ? `${videos} video(s)` : null,
      `${sizeBytes} bytes`,
    ]
      .filter(Boolean)
      .join(", ");

    return { catalogues, products, images, videos, sizeBytes, locked, label };
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

/** @deprecated prefer measureLiveContentAsync — kept for call-site clarity */
export async function countActiveCataloguesAsync(dbFile) {
  const snap = await measureLiveContentAsync(dbFile);
  return snap?.catalogues ?? null;
}

export function backupsDir(root) {
  return path.join(persistentDataDir(root), "backups");
}

export function persistentUploadsDir(root) {
  return path.join(persistentDataDir(root), "uploads");
}

/**
 * Copy live DB to tfrc-persistent/backups/prod-YYYYMMDD-HHMMSS.db
 * and prune older backups (keep last MAX_BACKUPS).
 */
export function backupLiveDatabase(root, livePath, reason = "safety") {
  if (!livePath || !fs.existsSync(livePath)) return null;
  if (fs.statSync(livePath).size < 1000) return null;

  const dir = backupsDir(root);
  if (!canWriteDir(dir)) {
    console.warn(`[db-safety] Cannot write backups dir ${dir}`);
    return null;
  }

  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19);
  const dest = path.join(dir, `prod-${stamp}-${reason}.db`);
  try {
    copyDbAtomic(livePath, dest);
    console.log(
      `[db-safety] Backup written ${dest} (${fs.statSync(dest).size} bytes)`
    );
    pruneBackups(dir);
    return dest;
  } catch (err) {
    console.warn(`[db-safety] Backup failed:`, err?.message ?? err);
    return null;
  }
}

function pruneBackups(dir) {
  try {
    const files = fs
      .readdirSync(dir)
      .filter((name) => /^prod-.*\.db$/i.test(name))
      .map((name) => {
        const full = path.join(dir, name);
        return { full, mtimeMs: fs.statSync(full).mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);

    for (const old of files.slice(MAX_BACKUPS)) {
      try {
        fs.unlinkSync(old.full);
        console.log(`[db-safety] Pruned old backup ${path.basename(old.full)}`);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
}

/**
 * One-way migrate app-tree upload folders → tfrc-persistent/uploads.
 * Never deletes source. Never overwrites a larger/newer persistent file.
 */
export function ensurePersistentUploads(root) {
  const destRoot = persistentUploadsDir(root);
  if (!canWriteDir(destRoot)) {
    console.warn(`[db-safety] Cannot write persistent uploads ${destRoot}`);
    return { migrated: 0, destRoot };
  }

  const sources = [
    path.join(root, "public", "uploads"),
    path.join(root, "uploads"),
    path.join(root, ".next", "standalone", "public", "uploads"),
    path.join(root, ".next", "standalone", "uploads"),
  ];

  let migrated = 0;
  for (const srcRoot of sources) {
    if (!fs.existsSync(srcRoot)) continue;
    migrated += copyUploadTree(srcRoot, destRoot);
  }

  // Mirror persistent → app public/uploads so Next can serve if needed,
  // but never shrink/replace richer persistent with empty app dirs (copy is one-way out).
  const appPublic = path.join(root, "public", "uploads");
  try {
    if (canWriteDir(appPublic)) {
      copyUploadTree(destRoot, appPublic);
    }
  } catch {
    /* ignore */
  }

  console.log(
    `[db-safety] Persistent uploads ready at ${destRoot} (migrated ${migrated} file(s) from app tree)`
  );
  return { migrated, destRoot };
}

function copyUploadTree(srcRoot, destRoot) {
  let copied = 0;
  const walk = (dir, rel = "") => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const from = path.join(dir, entry.name);
      const relPath = rel ? path.join(rel, entry.name) : entry.name;
      if (entry.isDirectory()) {
        walk(from, relPath);
        continue;
      }
      if (!entry.isFile()) continue;
      const to = path.join(destRoot, relPath);
      try {
        fs.mkdirSync(path.dirname(to), { recursive: true });
        if (fs.existsSync(to)) {
          const srcSize = fs.statSync(from).size;
          const destSize = fs.statSync(to).size;
          if (destSize >= srcSize) continue;
        }
        const temporary = `${to}.${process.pid}.tmp`;
        fs.copyFileSync(from, temporary);
        fs.renameSync(temporary, to);
        copied += 1;
      } catch {
        /* ignore single-file failures */
      }
    }
  };
  walk(srcRoot);
  return copied;
}

/**
 * Decide whether candidate may replace live.
 * Returns { allow: boolean, reason: string }
 */
export async function evaluateLiveOverwrite(root, livePath, candidatePath) {
  const liveExists =
    livePath && fs.existsSync(livePath) && fs.statSync(livePath).size >= 1000;

  if (!liveExists) {
    return { allow: true, reason: "live-missing-first-boot" };
  }

  if (!candidatePath || path.resolve(candidatePath) === path.resolve(livePath)) {
    return { allow: false, reason: "same-file" };
  }

  if (isSeedDatabasePath(root, candidatePath)) {
    return { allow: false, reason: "candidate-is-seed" };
  }

  const live = await measureLiveContentAsync(livePath);
  if (!live) {
    return { allow: false, reason: "live-unreadable-refuse-overwrite" };
  }
  if (live.locked) {
    return {
      allow: false,
      reason: `live-locked (${live.label})`,
    };
  }

  const liveSize = live.sizeBytes;
  const candSize = fs.existsSync(candidatePath)
    ? fs.statSync(candidatePath).size
    : 0;
  if (candSize <= liveSize) {
    return { allow: false, reason: "candidate-not-larger" };
  }

  return { allow: true, reason: "live-empty-promote-richer" };
}

/**
 * Abort deploy if any locked content metric dropped.
 */
export function contentDropped(before, after) {
  if (!before?.locked || !after) return null;
  const checks = [
    ["catalogues", before.catalogues, after.catalogues],
    ["products", before.products, after.products],
    ["images", before.images, after.images],
    ["videos", before.videos, after.videos],
    ["sizeBytes", before.sizeBytes, after.sizeBytes],
  ];
  for (const [name, prev, next] of checks) {
    if (prev == null || next == null) continue;
    // Allow tiny size churn from WAL/vacuum; flag real shrinks (>2% or 10KB).
    if (name === "sizeBytes") {
      const floor = Math.max(prev - 10_000, Math.floor(prev * 0.98));
      if (next < floor) {
        return `${name} ${prev} → ${next}`;
      }
      continue;
    }
    if (next < prev) {
      return `${name} ${prev} → ${next}`;
    }
  }
  return null;
}
