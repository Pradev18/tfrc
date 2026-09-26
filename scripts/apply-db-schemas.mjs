/**
 * One-shot: add PostgreSQL multi-schema annotations to prisma/schema.prisma
 * Domains: auth | catalog | activity
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = path.join(root, "prisma", "schema.prisma");
let src = fs.readFileSync(schemaPath, "utf8");

const AUTH = new Set([
  "User",
  "LoginApproval",
  "LoginThrottle",
  "Role",
  "Permission",
  "UserRole",
  "RolePermission",
  "AuditLog",
]);

const ACTIVITY = new Set([
  "CustomerInquiry",
  "CustomerInquiryItem",
  "OfficeReportImport",
  "OfficeReportInventoryItem",
  "OfficeReportImageLink",
  "OfficeReport",
  "OfficeReportLine",
  "OfficeReportImportStatus",
]);

const AUTH_ENUMS = new Set([]);
const ACTIVITY_ENUMS = new Set(["OfficeReportImportStatus"]);
const CATALOG_ENUMS = new Set([
  "EnvironmentStatus",
  "ProductStatus",
  "PriceType",
  "InventoryTxType",
  "ImportStatus",
]);

function domainForModel(name) {
  if (AUTH.has(name)) return "auth";
  if (ACTIVITY.has(name)) return "activity";
  return "catalog";
}

function domainForEnum(name) {
  if (ACTIVITY_ENUMS.has(name)) return "activity";
  if (AUTH_ENUMS.has(name)) return "auth";
  if (CATALOG_ENUMS.has(name)) return "catalog";
  return "catalog";
}

// Fix datasource
src = src.replace(
  /datasource db \{[\s\S]*?\n\}/,
  `datasource db {
  // Single Neon Postgres — three schemas (proper ecommerce domains).
  // Hostinger redeploys never touch this data (only app code updates).
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["auth", "catalog", "activity"]
}`
);

// Add @@schema to models that don't have it
src = src.replace(/model (\w+) \{([\s\S]*?)\n\}/g, (full, name, body) => {
  if (body.includes("@@schema(")) return full;
  const schema = domainForModel(name);
  const trimmed = body.replace(/\n$/, "");
  return `model ${name} {${trimmed}\n  @@schema("${schema}")\n}`;
});

// Add @@schema to enums
src = src.replace(/enum (\w+) \{([\s\S]*?)\n\}/g, (full, name, body) => {
  if (body.includes("@@schema(")) return full;
  const schema = domainForEnum(name);
  const trimmed = body.replace(/\n$/, "");
  return `enum ${name} {${trimmed}\n  @@schema("${schema}")\n}`;
});

fs.writeFileSync(schemaPath, src);
console.log("Updated", schemaPath);
