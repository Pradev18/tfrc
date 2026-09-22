import path from "node:path";
import { mkdir } from "node:fs/promises";
import { build } from "esbuild";

const root = process.cwd();
const outputDir = path.join(root, "scripts", "runtime");

await mkdir(outputDir, { recursive: true });

const workers = [
  ["office-report-parse-worker.cjs", "office-report-parse-worker.cjs"],
  ["catalogue-excel-parse-worker.cjs", "catalogue-excel-parse-worker.cjs"],
];

for (const [entryName, outputName] of workers) {
  await build({
    entryPoints: [path.join(root, "scripts", entryName)],
    outfile: path.join(outputDir, outputName),
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    minify: true,
    legalComments: "none",
    logLevel: "warning",
  });
}

console.log(`[workers] built ${workers.length} self-contained Excel workers`);
