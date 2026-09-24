/**
 * Ensures SQLite prod DB exists before build/start (Hostinger).
 *
 * Live owner catalogues/reports live in ../tfrc-persistent/prod.db (or TFRC_DATA_DIR)
 * so git deploys NEVER replace them with the default seed database.
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import {
  canWriteDir,
  copyDbAtomic,
  isSeedDatabasePath,
  persistentDataDir,
  persistentDbPath,
  pickBestDbPath,
  seedDbPath,
} from "./lib/db-location.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./prod.db";
}

function run(cmd) {
  execSync(cmd, { cwd: root, stdio: "inherit", env: process.env });
}

function resolveSqlitePath(url) {
  if (!url?.startsWith("file:")) return null;
  const filePath = url.replace(/^file:/, "").replace(/^\.\//, "");
  return path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
}

const url = process.env.DATABASE_URL;
if (!url.startsWith("file:")) {
  console.log("[db] Non-SQLite DATABASE_URL — skipping auto setup.");
  process.exit(0);
}

const persistDir = persistentDataDir(root);
let livePath = persistentDbPath(root);

if (!canWriteDir(persistDir)) {
  const fallbackDir = path.join("/tmp", "vitanova-db");
  console.warn(`[db] ${persistDir} not writable — using ${fallbackDir}`);
  fs.mkdirSync(fallbackDir, { recursive: true });
  livePath = path.join(fallbackDir, "prod.db");
}

const configured = resolveSqlitePath(url);
const best = pickBestDbPath(root, configured || livePath);
const seed = seedDbPath(root);
const liveExists =
  fs.existsSync(livePath) && fs.statSync(livePath).size >= 1000;

// If a richer OWNER database already exists anywhere, adopt it into the
// persistent path — but NEVER promote the shipped seed over live owner data.
if (best && path.resolve(best.path) !== path.resolve(livePath)) {
  if (liveExists && isSeedDatabasePath(root, best.path)) {
    console.log(
      `[db] Refusing to replace live owner database with seed (${best.path})`
    );
  } else if (!liveExists || fs.statSync(livePath).size < best.size) {
    console.log(
      `[db] Promoting richest database (${best.size} bytes) → persistent ${livePath}`
    );
    try {
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
  if (seed) {
    console.log(`[db] First boot — copying seed database → ${livePath}`);
    copyDbAtomic(seed, livePath);
  } else {
    console.log(`[db] No seed DB — creating schema + seeding at ${livePath}`);
    process.env.DATABASE_URL = `file:${livePath}`;
    run("npx prisma db push --skip-generate");
    run("npx tsx prisma/seed.ts");
  }
} else {
  console.log(
    `[db] Keeping live owner database (${fs.statSync(livePath).size} bytes) at ${livePath}`
  );
}

process.env.DATABASE_URL = `file:${livePath}`;

// Keep a convenience copy inside the app tree for tools that still look under prisma/,
// but NEVER copy the other way (seed must not overwrite persistent live data).
try {
  const appCopy = path.join(root, "prisma", "prod.db");
  if (
    !fs.existsSync(appCopy) ||
    fs.statSync(appCopy).size < fs.statSync(livePath).size
  ) {
    copyDbAtomic(livePath, appCopy);
    console.log(`[db] Synced app copy → ${appCopy}`);
  }
} catch (err) {
  console.warn("[db] Could not sync prisma/prod.db copy:", err?.message ?? err);
}

try {
  run("npx prisma db push --skip-generate");
} catch (err) {
  console.warn("[db] prisma db push warning:", err?.message ?? err);
}

run("node scripts/migrate-admin-password.mjs");
run("node scripts/migrate-product-item-no.mjs");

console.log("[db] Ready. DATABASE_URL=", process.env.DATABASE_URL);
console.log("[db] Persistent data dir=", path.dirname(livePath));
