/**
 * Copies local dev.db → prod.db for Netlify deployment.
 * Run before pushing: npm run db:prepare-prod
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "prisma", "dev.db");
const dest = path.join(root, "prisma", "prod.db");

if (!fs.existsSync(src)) {
  console.error("Missing prisma/dev.db — run npm run db:seed first.");
  process.exit(1);
}

fs.copyFileSync(src, dest);
const mb = (fs.statSync(dest).size / (1024 * 1024)).toFixed(2);
console.log(`Created prisma/prod.db (${mb} MB) — commit this file for Netlify.`);
