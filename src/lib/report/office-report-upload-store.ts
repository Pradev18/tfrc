import { mkdir, readFile, writeFile, unlink } from "fs/promises";
import path from "path";

function storeDirectories(): string[] {
  const cwd = process.cwd();
  return [
    path.join(cwd, "uploads", "report-imports"),
    path.join(cwd, "public", "uploads", "report-imports"),
    path.join(cwd, ".next", "standalone", "uploads", "report-imports"),
    path.join("/tmp", "vitanova-report-imports"),
  ];
}

export async function saveReportImportWorkbook(importId: string, buffer: Buffer): Promise<void> {
  const filename = `${importId}.xlsx`;
  let written = false;
  const errors: string[] = [];
  for (const dir of storeDirectories()) {
    try {
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, filename), buffer);
      written = true;
    } catch (error) {
      errors.push(`${dir}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (!written) {
    throw new Error(
      `Could not store the workbook for import. ${errors[0] ?? "Upload directory is not writable."}`
    );
  }
}

export async function readReportImportWorkbook(importId: string): Promise<Buffer | null> {
  if (!/^[a-z0-9_-]+$/i.test(importId)) return null;
  const filename = `${importId}.xlsx`;
  for (const dir of storeDirectories()) {
    try {
      return await readFile(path.join(dir, filename));
    } catch {
      // try next
    }
  }
  return null;
}

export async function deleteReportImportWorkbook(importId: string): Promise<void> {
  const filename = `${importId}.xlsx`;
  await Promise.all(
    storeDirectories().map(async (dir) => {
      try {
        await unlink(path.join(dir, filename));
      } catch {
        // ignore missing
      }
    })
  );
}
