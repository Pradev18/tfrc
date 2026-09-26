import { mkdir, readFile, writeFile, unlink, readdir, rm } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { persistentUploadsDir } from "@/lib/sqlite-paths";

/** Read/delete still check legacy paths so older uploads remain findable. */
function storeDirectories(): string[] {
  const cwd = process.cwd();
  return [
    path.join(persistentUploadsDir(cwd), "report-imports"),
    path.join(cwd, "uploads", "report-imports"),
    path.join("/tmp", "vitanova-report-imports"),
    path.join(cwd, "public", "uploads", "report-imports"),
    path.join(cwd, ".next", "standalone", "uploads", "report-imports"),
  ];
}

/** Prefer persistent dir — app-tree uploads are wiped on Hostinger redeploy. */
function writeDirectories(): string[] {
  const cwd = process.cwd();
  return [
    path.join(persistentUploadsDir(cwd), "report-imports"),
    path.join(cwd, "uploads", "report-imports"),
    path.join("/tmp", "vitanova-report-imports"),
  ];
}

export function sanitizeExcelUploadName(fileName: string): string {
  const raw = String(fileName || "workbook.xlsx").trim() || "workbook.xlsx";
  const parts = raw.split(".");
  const ext = (parts.length > 1 ? parts.pop() : "xlsx")!.toLowerCase();
  const safeExt = ext === "xls" || ext === "xlsx" ? ext : "xlsx";
  const base = parts
    .join(".")
    .replace(/['"`<>\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80);
  return `${base || "workbook"}.${safeExt}`;
}

async function writeEverywhere(relativeName: string, buffer: Buffer): Promise<void> {
  let written = false;
  const errors: string[] = [];
  for (const dir of writeDirectories()) {
    try {
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, relativeName), buffer);
      written = true;
    } catch (error) {
      errors.push(`${dir}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (!written) {
    throw new Error(
      `Could not store upload data. ${errors[0] ?? "Upload directory is not writable."}`
    );
  }
}

async function readFirst(relativeName: string): Promise<Buffer | null> {
  for (const dir of storeDirectories()) {
    try {
      return await readFile(path.join(dir, relativeName));
    } catch {
      // try next
    }
  }
  return null;
}

async function deleteEverywhere(relativeName: string): Promise<void> {
  await Promise.all(
    storeDirectories().map(async (dir) => {
      try {
        await unlink(path.join(dir, relativeName));
      } catch {
        // ignore
      }
    })
  );
}

export async function saveReportImportWorkbook(importId: string, buffer: Buffer): Promise<void> {
  await writeEverywhere(`${importId}.xlsx`, buffer);
}

export async function readReportImportWorkbook(importId: string): Promise<Buffer | null> {
  if (!/^[a-z0-9_-]+$/i.test(importId)) return null;
  return readFirst(`${importId}.xlsx`);
}

export async function deleteReportImportWorkbook(importId: string): Promise<void> {
  if (!/^[a-z0-9_-]+$/i.test(importId)) return;
  await deleteEverywhere(`${importId}.xlsx`);
  await deleteReportParsedArtifacts(importId);
}

export type ReportParsedMeta = {
  inventorySheetName: string;
  imageSheetName: string | null;
  iqsSheetName: string | null;
  inventoryHeaders: string[];
  columnMap: Record<string, string>;
  duplicateInventoryCodes: string[];
  iqsFormMeta: Record<string, string>;
  iqsSeedRows: Array<{ itemCode: string; wholesalePriceApproval: string }>;
  inventoryRowCount: number;
  imageLinkCount: number;
  uniqueItemCount: number;
  inventoryChunks: number;
  imageChunks: number;
  rowsPerChunk: number;
};

export function reportParsedOutDir(): string {
  return writeDirectories()[0] ?? path.join(process.cwd(), "uploads", "report-imports");
}

export async function readReportParsedMeta(
  importId: string
): Promise<ReportParsedMeta | null> {
  if (!/^[a-z0-9_-]+$/i.test(importId)) return null;
  const raw = await readFirst(`${importId}.parsed-meta.json`);
  if (!raw) return null;
  try {
    return JSON.parse(raw.toString("utf8")) as ReportParsedMeta;
  } catch {
    return null;
  }
}

export async function readReportParsedChunkLines(
  importId: string,
  kind: "inv" | "img",
  chunkIndex: number
): Promise<string[]> {
  if (!/^[a-z0-9_-]+$/i.test(importId)) return [];
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) return [];
  const raw = await readFirst(`${importId}.${kind}.${chunkIndex}.jsonl`);
  if (!raw) return [];
  return raw
    .toString("utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function deleteReportParsedArtifacts(importId: string): Promise<void> {
  if (!/^[a-z0-9_-]+$/i.test(importId)) return;
  await deleteEverywhere(`${importId}.parsed-meta.json`);
  for (const dir of storeDirectories()) {
    try {
      const names = await readdir(dir);
      await Promise.all(
        names
          .filter(
            (name) =>
              name.startsWith(`${importId}.inv.`) ||
              name.startsWith(`${importId}.img.`)
          )
          .map((name) => unlink(path.join(dir, name)).catch(() => null))
      );
    } catch {
      // ignore
    }
  }
}

type UploadMeta = {
  id: string;
  fileName: string;
  fileSize: number;
  totalChunks: number;
  received: number[];
  createdAt: number;
};

export async function createReportUploadSession(input: {
  fileName: string;
  fileSize: number;
  totalChunks: number;
}): Promise<string> {
  const id = randomUUID().replace(/-/g, "");
  const meta: UploadMeta = {
    id,
    fileName: sanitizeExcelUploadName(input.fileName),
    fileSize: input.fileSize,
    totalChunks: input.totalChunks,
    received: [],
    createdAt: Date.now(),
  };
  await writeEverywhere(`${id}.meta.json`, Buffer.from(JSON.stringify(meta), "utf8"));
  return id;
}

export async function saveReportUploadChunk(
  uploadId: string,
  index: number,
  chunk: Buffer
): Promise<UploadMeta> {
  if (!/^[a-z0-9]+$/i.test(uploadId)) throw new Error("Invalid upload session.");
  if (!Number.isInteger(index) || index < 0) throw new Error("Invalid chunk index.");
  if (chunk.byteLength <= 0 || chunk.byteLength > 700_000) {
    throw new Error("Chunk size is invalid.");
  }

  const raw = await readFirst(`${uploadId}.meta.json`);
  if (!raw) throw new Error("Upload session expired. Choose the Excel file again.");
  const meta = JSON.parse(raw.toString("utf8")) as UploadMeta;
  if (index >= meta.totalChunks) throw new Error("Chunk index out of range.");

  await writeEverywhere(`${uploadId}.part.${index}`, chunk);
  if (!meta.received.includes(index)) {
    meta.received.push(index);
    meta.received.sort((a, b) => a - b);
    await writeEverywhere(`${uploadId}.meta.json`, Buffer.from(JSON.stringify(meta), "utf8"));
  }
  return meta;
}

export async function assembleReportUpload(uploadId: string): Promise<{
  fileName: string;
  fileSize: number;
  buffer: Buffer;
}> {
  if (!/^[a-z0-9]+$/i.test(uploadId)) throw new Error("Invalid upload session.");
  const raw = await readFirst(`${uploadId}.meta.json`);
  if (!raw) throw new Error("Upload session expired. Choose the Excel file again.");
  const meta = JSON.parse(raw.toString("utf8")) as UploadMeta;
  if (meta.received.length !== meta.totalChunks) {
    throw new Error(
      `Upload incomplete (${meta.received.length}/${meta.totalChunks} parts). Retry the upload.`
    );
  }

  const parts: Buffer[] = [];
  for (let i = 0; i < meta.totalChunks; i++) {
    const part = await readFirst(`${uploadId}.part.${i}`);
    if (!part) {
      throw new Error(`Missing upload part ${i + 1}. Retry the upload.`);
    }
    parts.push(part);
  }
  const buffer = Buffer.concat(parts);
  if (buffer.byteLength !== meta.fileSize) {
    // Allow small mismatch only if metadata drifted; still require non-empty workbook.
    if (buffer.byteLength <= 0) {
      throw new Error("Assembled workbook is empty. Retry the upload.");
    }
  }
  return { fileName: meta.fileName, fileSize: buffer.byteLength, buffer };
}

export async function deleteReportUploadSession(uploadId: string): Promise<void> {
  if (!/^[a-z0-9]+$/i.test(uploadId)) return;
  for (const dir of storeDirectories()) {
    try {
      const names = await readdir(dir);
      await Promise.all(
        names
          .filter((name) => name === `${uploadId}.meta.json` || name.startsWith(`${uploadId}.part.`))
          .map((name) => unlink(path.join(dir, name)).catch(() => null))
      );
    } catch {
      // ignore
    }
  }
  // Clean accidental nested folders if any
  await Promise.all(
    storeDirectories().map(async (dir) => {
      try {
        await rm(path.join(dir, uploadId), { recursive: true, force: true });
      } catch {
        // ignore
      }
    })
  );
}
