/**
 * Hostinger recovery — find richest SQLite and restore into tfrc-persistent.
 * Run from the app root on Hostinger Terminal / SSH:
 *   node scripts/recover-live-db.mjs
 *
 * NEVER deletes source files. Only copies the richest found DB into
 * ../tfrc-persistent/prod.db after backing up whatever is there now.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  canWriteDir,
  copyDbAtomic,
  persistentDataDir,
  persistentDbPath,
} from "./lib/db-location.mjs";
import { measureLiveContentAsync } from "./lib/db-safety.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function walkFind(dir, out, depth = 0) {
  if (depth > 6 || !fs.existsSync(dir)) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === ".git" ||
        entry.name === ".next"
      ) {
        continue;
      }
      walkFind(full, out, depth + 1);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!/\.db$/i.test(entry.name)) continue;
    if (/\.(tmp|bak)$/i.test(entry.name)) continue;
    try {
      const size = fs.statSync(full).size;
      if (size >= 1000) out.push({ path: full, size });
    } catch {
      /* ignore */
    }
  }
}

async function main() {
  const candidates = [
    path.join("/tmp", "vitanova-prod.db"),
    path.join("/tmp", "vitanova-db", "prod.db"),
    path.join(root, "prisma", "prod.db"),
    path.join(root, "prod.db"),
    path.join(root, "..", "tfrc-persistent", "prod.db"),
    path.join(root, "..", "..", "tfrc-persistent", "prod.db"),
  ];

  const found = [];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).size >= 1000) {
      found.push({ path: c, size: fs.statSync(c).size });
    }
  }

  // Broad search near the app and /tmp
  walkFind("/tmp", found);
  walkFind(path.join(root, ".."), found);
  walkFind(path.join(root, "..", ".."), found);

  // Dedupe
  const byPath = new Map();
  for (const f of found) byPath.set(path.resolve(f.path), f);
  const unique = [...byPath.values()].sort((a, b) => b.size - a.size);

  console.log("[recover] Found DB files (largest first):");
  for (const f of unique.slice(0, 20)) {
    const snap = await measureLiveContentAsync(f.path);
    console.log(
      `  ${f.size} bytes | ${snap?.label ?? "unreadable"} | ${f.path}`
    );
  }

  if (!unique.length) {
    console.error("[recover] FATAL: no SQLite files found to restore from.");
    process.exit(1);
  }

  // Prefer richest by product count, then size
  let best = null;
  let bestSnap = null;
  for (const f of unique) {
    const snap = await measureLiveContentAsync(f.path);
    if (!snap) continue;
    const score =
      (snap.products ?? 0) * 1_000_000 +
      (snap.catalogues ?? 0) * 10_000 +
      (snap.images ?? 0) * 10 +
      snap.sizeBytes;
    if (!best || score > best.score) {
      best = { ...f, score };
      bestSnap = snap;
    }
  }

  if (!best || !bestSnap) {
    best = unique[0];
    bestSnap = await measureLiveContentAsync(best.path);
  }

  console.log(
    `[recover] Selected: ${best.path} (${bestSnap?.label ?? best.size + " bytes"})`
  );

  const destDir = persistentDataDir(root);
  const dest = persistentDbPath(root);
  if (!canWriteDir(destDir)) {
    console.error(`[recover] FATAL: cannot write ${destDir}`);
    process.exit(1);
  }

  if (fs.existsSync(dest) && fs.statSync(dest).size >= 1000) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const bak = path.join(destDir, "backups", `pre-recover-${stamp}.db`);
    fs.mkdirSync(path.dirname(bak), { recursive: true });
    copyDbAtomic(dest, bak);
    console.log(`[recover] Backed up current live DB → ${bak}`);
  }

  if (path.resolve(best.path) === path.resolve(dest)) {
    console.log("[recover] Selected file is already the live DB — nothing to copy.");
  } else {
    copyDbAtomic(best.path, dest);
    console.log(`[recover] Restored → ${dest} (${fs.statSync(dest).size} bytes)`);
  }

  // Also refresh app copy
  try {
    copyDbAtomic(dest, path.join(root, "prisma", "prod.db"));
  } catch {
    /* ignore */
  }

  const finalSnap = await measureLiveContentAsync(dest);
  console.log(`[recover] DONE. Live content: ${finalSnap?.label ?? "unknown"}`);
  console.log("[recover] Restart the app (Save and redeploy, or restart Node).");
}

main().catch((err) => {
  console.error("[recover] FATAL:", err);
  process.exit(1);
});
