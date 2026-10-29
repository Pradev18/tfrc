/**
 * Hostinger Node plans often hit OS thread limits during `next build`
 * ("Resource temporarily unavailable" / SIGABRT while collecting page data).
 * Cap thread/worker usage so the build can finish on a small VPS.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");

process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || "2";
process.env.RAYON_NUM_THREADS = process.env.RAYON_NUM_THREADS || "1";
process.env.NEXT_TELEMETRY_DISABLED = process.env.NEXT_TELEMETRY_DISABLED || "1";
process.env.NEXT_BUILD_CPUS = process.env.NEXT_BUILD_CPUS || "1";

const nodeOptions = process.env.NODE_OPTIONS || "";
if (!/\b--max-old-space-size=/.test(nodeOptions)) {
  process.env.NODE_OPTIONS = `${nodeOptions} --max-old-space-size=3072`.trim();
}

const result = spawnSync(process.execPath, [nextBin, "build"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  console.error("[next-build-safe]", result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
