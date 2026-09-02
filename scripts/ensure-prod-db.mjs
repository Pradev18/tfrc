/**
 * Ensures SQLite prod DB exists before build/start (Hostinger has no manual setup step).
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./prisma/prod.db";
}

function resolveDbPath() {
  const url = process.env.DATABASE_URL || "file:./prisma/prod.db";
  if (!url.startsWith("file:")) {
    console.log("[db] Non-SQLite DATABASE_URL — skipping auto setup.");
    return null;
  }

  const filePath = url.replace(/^file:/, "").replace(/^\.\//, "");
  return path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
}

function run(cmd) {
  execSync(cmd, { cwd: root, stdio: "inherit", env: process.env });
}

const dbPath = resolveDbPath();
if (!dbPath) process.exit(0);

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

if (!fs.existsSync(dbPath)) {
  console.log(`[db] Creating ${path.relative(root, dbPath)} …`);
  run("npx prisma db push");
  run("npx tsx prisma/seed.ts");
  console.log("[db] Database ready.");
} else {
  console.log(`[db] Found ${path.relative(root, dbPath)} — applying schema if needed.`);
  run("npx prisma db push");
}
