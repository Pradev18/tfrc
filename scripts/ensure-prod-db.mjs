/**
 * Ensures SQLite prod DB + uploaded media survive Hostinger deploys.
 *
 * ZERO DATA LOSS RULE:
 * Live owner catalogues AND all uploaded contents (products, images, videos,
 * Excel/report files) live under ../tfrc-persistent/ (or TFRC_DATA_DIR).
 * If that DB already has owner data, it is LOCKED forever against seed / demo /
 * smaller / "newer" deploy copies — even at 1000 catalogues with full Excel data.
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import {
  canWriteDir,
  copyDbAtomic,
  isSeedDatabasePath,
  normalizeDatabaseUrl,
  persistentDataDir,
  persistentDbPath,
  pickBestDbPath,
  resolveDatabaseUrlPath,
  seedDbPath,
} from "./lib/db-location.mjs";
import {
  backupLiveDatabase,
  contentDropped,
  ensurePersistentUploads,
  evaluateLiveOverwrite,
  measureLiveContentAsync,
} from "./lib/db-safety.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd) {
  execSync(cmd, { cwd: root, stdio: "inherit", env: process.env });
}

async function main() {
  // Hostinger sometimes wraps values in quotes or leaves a non-file URL.
  // When TFRC_DATA_DIR is set, force the durable SQLite path.
  let url = normalizeDatabaseUrl(process.env.DATABASE_URL);
  const persistDir = persistentDataDir(root);
  const durableSqlite = `file:${persistentDbPath(root).replace(/\\/g, "/")}`;

  if (process.env.TFRC_DATA_DIR?.trim()) {
    if (!url.startsWith("file:")) {
      console.warn(
        `[db-safety] DATABASE_URL was not SQLite (${url || "empty"}) — forcing ${durableSqlite}`
      );
    }
    url = durableSqlite;
  } else if (!url) {
    url = "file:./prod.db";
  }

  process.env.DATABASE_URL = url;

  if (!url.startsWith("file:")) {
    console.log(
      `[db] Non-SQLite DATABASE_URL (${url.slice(0, 32)}…) — skipping auto setup.`
    );
    return;
  }

  const isProduction =
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.TFRC_DATA_DIR?.trim());

  let livePath = persistentDbPath(root);

  // Local/dev: honour DATABASE_URL (e.g. prisma/dev.db) and do not create a
  // blank persistent DB that would steal the connection from the owner's file.
  const envDb = resolveDatabaseUrlPath(root, url);
  if (!isProduction && envDb && fs.existsSync(envDb) && /dev\.db$/i.test(envDb)) {
    livePath = envDb;
    console.log(`[db] Dev mode — using DATABASE_URL database ${livePath}`);
  } else if (!canWriteDir(persistDir)) {
    // Never silently move live owner data to /tmp — that disappears on restart.
    const existingPersistent = persistentDbPath(root);
    if (
      isProduction &&
      fs.existsSync(existingPersistent) &&
      fs.statSync(existingPersistent).size >= 1000
    ) {
      console.error(
        `[db-safety] FATAL: persistent dir ${persistDir} is not writable but live owner DB exists. Fix permissions — refusing /tmp fallback.`
      );
      process.exit(1);
    }
    if (isProduction) {
      console.error(
        `[db-safety] FATAL: persistent dir ${persistDir} is not writable in production. Refusing /tmp fallback (would lose catalogues + uploads on restart).`
      );
      process.exit(1);
    }
    const fallbackDir = path.join("/tmp", "vitanova-db");
    console.warn(`[db] ${persistDir} not writable — using ${fallbackDir}`);
    fs.mkdirSync(fallbackDir, { recursive: true });
    livePath = path.join(fallbackDir, "prod.db");
  }

  const best = pickBestDbPath(root, livePath);
  const seed = seedDbPath(root);
  const liveExists =
    fs.existsSync(livePath) && fs.statSync(livePath).size >= 1000;

  let lockedSnapshot = null;

  // Snapshot + lock on every production build/start when owner data exists.
  if (isProduction && liveExists) {
    const snap = await measureLiveContentAsync(livePath);
    if (snap?.locked) {
      lockedSnapshot = snap;
      backupLiveDatabase(root, livePath, "pre-deploy");
      console.log(`[db-safety] LIVE LOCKED — ${snap.label} at ${livePath}`);
    }
  }

  // Keep uploaded images/Excel/PDFs outside the wiped app tree.
  if (isProduction) {
    ensurePersistentUploads(root);
  }

  // Promote another DB into persistent ONLY when safety allows.
  if (
    isProduction &&
    best &&
    path.resolve(best.path) !== path.resolve(livePath)
  ) {
    const verdict = await evaluateLiveOverwrite(root, livePath, best.path);
    if (!verdict.allow) {
      console.log(
        `[db-safety] Refusing to overwrite live DB ← ${best.path} (${verdict.reason})`
      );
    } else {
      console.log(
        `[db] Promoting database (${best.size} bytes) → persistent ${livePath} (${verdict.reason})`
      );
      try {
        if (liveExists) backupLiveDatabase(root, livePath, "pre-promote");
        copyDbAtomic(best.path, livePath);
      } catch (err) {
        console.warn(
          "[db] Could not promote to persistent path:",
          err?.message ?? err
        );
        livePath = best.path;
      }
    }
  }

  if (!fs.existsSync(livePath) || fs.statSync(livePath).size < 1000) {
    if (lockedSnapshot?.locked) {
      console.error(
        `[db-safety] FATAL: live lock held (${lockedSnapshot.label}) but DB file is missing/tiny at ${livePath}`
      );
      process.exit(1);
    }
    console.log(`[db] First boot — creating empty live schema at ${livePath}`);
    process.env.DATABASE_URL = `file:${livePath}`;
    fs.mkdirSync(path.dirname(livePath), { recursive: true });
    run("npx prisma db push --skip-generate");
    try {
      run("node scripts/migrate-admin-password.mjs");
    } catch (err) {
      console.warn("[db] admin bootstrap warning:", err?.message ?? err);
    }
    if (seed) {
      console.log(
        `[db-safety] Seed file exists at ${seed} but was NOT copied over live (zero demo overwrite policy).`
      );
    }
  } else {
    const size = fs.statSync(livePath).size;
    const snap = await measureLiveContentAsync(livePath);
    console.log(
      `[db] Keeping live owner database (${size} bytes` +
        (snap?.label ? `, ${snap.label}` : "") +
        `) at ${livePath}`
    );
  }

  process.env.DATABASE_URL = `file:${livePath}`;

  // One-way mirror: live → app tree only. Never the reverse when locked.
  if (isProduction) {
    try {
      const appCopy = path.join(root, "prisma", "prod.db");
      if (
        !fs.existsSync(appCopy) ||
        fs.statSync(appCopy).size < fs.statSync(livePath).size ||
        isSeedDatabasePath(root, appCopy)
      ) {
        copyDbAtomic(livePath, appCopy);
        console.log(`[db] Synced app copy ← live → ${appCopy}`);
      } else {
        console.log(
          `[db] App copy already current (${fs.statSync(appCopy).size} bytes)`
        );
      }
    } catch (err) {
      console.warn(
        "[db] Could not sync prisma/prod.db copy:",
        err?.message ?? err
      );
    }
  }

  try {
    run("npx prisma db push --skip-generate");
  } catch (err) {
    console.warn("[db] prisma db push warning:", err?.message ?? err);
  }

  run("node scripts/migrate-admin-password.mjs");
  run("node scripts/migrate-product-item-no.mjs");

  const finalSnap = await measureLiveContentAsync(livePath);
  const drop = contentDropped(lockedSnapshot, finalSnap);
  if (drop) {
    console.error(
      `[db-safety] FATAL: live content dropped (${drop}). Aborting so deploy cannot ship a wiped DB.`
    );
    process.exit(1);
  }

  console.log("[db] Ready. DATABASE_URL=", process.env.DATABASE_URL);
  console.log("[db] Persistent data dir=", path.dirname(livePath));
  console.log(
    `[db-safety] Post-start live content: ${
      finalSnap?.label ?? "unknown"
    } (catalogues + products + images must not drop after deploys)`
  );
}

main().catch((err) => {
  console.error("[db] FATAL ensure-prod-db:", err);
  process.exit(1);
});
