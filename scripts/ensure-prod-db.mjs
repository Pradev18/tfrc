/**
 * Ensures SQLite prod DB exists before build/start (Hostinger).
 * Copies committed prisma/prod.db when present; otherwise creates + seeds.
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

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

function findBundledDb() {
  const candidates = [
    path.join(root, "prisma", "prod.db"),
    path.join(process.cwd(), "prisma", "prod.db"),
    path.join(root, "..", "prisma", "prod.db"),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).size > 1000) {
        return candidate;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

function canWriteDir(dir) {
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

const url = process.env.DATABASE_URL;
if (!url.startsWith("file:")) {
  console.log("[db] Non-SQLite DATABASE_URL — skipping auto setup.");
  process.exit(0);
}

let dbPath = resolveSqlitePath(url);
const bundled = findBundledDb();

if (!dbPath) {
  console.error("[db] Could not resolve DATABASE_URL path");
  process.exit(1);
}

let dbDir = path.dirname(dbPath);
if (!canWriteDir(dbDir)) {
  const fallbackDir = path.join("/tmp", "vitanova-db");
  console.warn(`[db] ${dbDir} not writable — using ${fallbackDir}`);
  fs.mkdirSync(fallbackDir, { recursive: true });
  dbPath = path.join(fallbackDir, "prod.db");
  process.env.DATABASE_URL = `file:${dbPath}`;
  dbDir = fallbackDir;
}

// Prisma resolves file: URLs relative to prisma/schema.prisma. Always pass an
// absolute URL so CLI commands and the runtime use the exact same database.
process.env.DATABASE_URL = `file:${dbPath}`;

const needsCreate = !fs.existsSync(dbPath) || fs.statSync(dbPath).size < 1000;

if (needsCreate) {
  if (bundled && path.resolve(bundled) !== path.resolve(dbPath)) {
    console.log(`[db] Copying bundled database → ${dbPath}`);
    fs.copyFileSync(bundled, dbPath);
  } else if (bundled && path.resolve(bundled) === path.resolve(dbPath)) {
    console.log(`[db] Using bundled database at ${dbPath}`);
  } else {
    console.log(`[db] No bundled DB — creating schema + seeding at ${dbPath}`);
    run("npx prisma db push --skip-generate");
    run("npx tsx prisma/seed.ts");
  }
} else {
  console.log(`[db] Found database (${fs.statSync(dbPath).size} bytes) at ${dbPath}`);
}

try {
  run("npx prisma db push --skip-generate");
} catch (err) {
  console.warn("[db] prisma db push warning:", err?.message ?? err);
}

console.log("[db] Ready. DATABASE_URL=", process.env.DATABASE_URL);
