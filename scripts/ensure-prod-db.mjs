/**
 * Ensures production database is ready before build/start (Hostinger).
 *
 * Production MUST use external Postgres (Neon / Supabase / Hostinger Postgres).
 * SQLite file DBs on Hostinger get wiped/replaced on redeploy — that caused
 * catalogue data loss. When DATABASE_URL is postgres/mysql, this script only
 * runs schema push + safe migrations (never copies seed files).
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

function isExternalSqlUrl(url) {
  return /^(postgresql|postgres|mysql|sqlserver):\/\//i.test(url);
}

async function setupExternalDatabase(url) {
  process.env.DATABASE_URL = url;
  console.log(
    `[db] External database detected (${url.replace(/:[^:@/]+@/, ":***@").slice(0, 64)}…)`
  );
  console.log(
    "[db-safety] LIVE DATA is in the external DB — Hostinger redeploys cannot overwrite it."
  );

  try {
    run("npx prisma db push --skip-generate");
  } catch (err) {
    console.warn("[db] prisma db push warning:", err?.message ?? err);
  }

  try {
    run("node scripts/migrate-admin-password.mjs");
  } catch (err) {
    console.warn("[db] admin bootstrap warning:", err?.message ?? err);
  }

  try {
    run("node scripts/migrate-product-item-no.mjs");
  } catch (err) {
    console.warn("[db] itemNo migration warning:", err?.message ?? err);
  }

  // Uploads still need a durable folder on the app host (images/PDFs).
  if (process.env.NODE_ENV === "production" || process.env.TFRC_DATA_DIR?.trim()) {
    ensurePersistentUploads(root);
  }

  console.log("[db] Ready (external). DATABASE_URL is not a local SQLite file.");
}

async function setupSqliteLegacy() {
  // Hostinger sometimes wraps values in quotes.
  let url = normalizeDatabaseUrl(process.env.DATABASE_URL);
  const persistDir = persistentDataDir(root);
  const durableSqlite = `file:${persistentDbPath(root).replace(/\\/g, "/")}`;

  // Only force SQLite durable path when the URL is already file: or empty.
  // Never override an external Postgres URL (handled earlier).
  if (!url) {
    url = durableSqlite;
  } else if (
    url.startsWith("file:") &&
    process.env.TFRC_DATA_DIR?.trim()
  ) {
    url = durableSqlite;
  }

  process.env.DATABASE_URL = url;

  if (!url.startsWith("file:")) {
    console.log(
      `[db] Unrecognized DATABASE_URL (${url.slice(0, 32)}…) — skipping auto setup.`
    );
    return;
  }

  console.warn(
    "[db-safety] WARNING: SQLite file mode is legacy. Use external Postgres to prevent Hostinger data loss."
  );

  const isProduction =
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.TFRC_DATA_DIR?.trim());

  let livePath = persistentDbPath(root);

  const envDb = resolveDatabaseUrlPath(root, url);
  if (!isProduction && envDb && fs.existsSync(envDb) && /dev\.db$/i.test(envDb)) {
    livePath = envDb;
    console.log(`[db] Dev mode — using DATABASE_URL database ${livePath}`);
  } else if (!canWriteDir(persistDir)) {
    if (isProduction) {
      console.error(
        `[db-safety] FATAL: persistent dir ${persistDir} is not writable. Use external Postgres instead of SQLite.`
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

  if (isProduction && liveExists) {
    const snap = await measureLiveContentAsync(livePath);
    if (snap?.locked) {
      lockedSnapshot = snap;
      backupLiveDatabase(root, livePath, "pre-deploy");
      console.log(`[db-safety] LIVE LOCKED — ${snap.label} at ${livePath}`);
    }
  }

  if (isProduction) {
    ensurePersistentUploads(root);
  }

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

async function main() {
  const url = normalizeDatabaseUrl(process.env.DATABASE_URL);

  if (isExternalSqlUrl(url)) {
    await setupExternalDatabase(url);
    return;
  }

  // Guard: if someone set TFRC_DATA_DIR but forgot file: and also didn't set Postgres,
  // do NOT invent SQLite when they intended external — require an explicit URL.
  if (!url && process.env.NODE_ENV === "production") {
    console.error(
      "[db-safety] FATAL: DATABASE_URL is missing in production. Set a Postgres URL (Neon/Supabase), e.g. postgresql://USER:PASS@HOST/DB?sslmode=require"
    );
    process.exit(1);
  }

  await setupSqliteLegacy();
}

main().catch((err) => {
  console.error("[db] FATAL ensure-prod-db:", err);
  process.exit(1);
});
