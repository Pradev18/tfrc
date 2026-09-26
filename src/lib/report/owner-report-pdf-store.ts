import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { persistentUploadsDir } from "@/lib/sqlite-paths";

const MAX_PDF_BYTES = 20 * 1024 * 1024;

function storeDirectories(): string[] {
  const cwd = process.cwd();
  return [
    path.join(persistentUploadsDir(cwd), "owner-reports"),
    path.join(cwd, "uploads", "owner-reports"),
    path.join(cwd, "public", "uploads", "owner-reports"),
    path.join(cwd, ".next", "standalone", "uploads", "owner-reports"),
    path.join("/tmp", "vitanova-owner-reports"),
  ];
}

function isPdf(buffer: Buffer): boolean {
  return buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}

export async function saveOwnerReportPdf(buffer: Buffer): Promise<string> {
  if (!isPdf(buffer)) throw new Error("File is not a PDF");
  if (buffer.length > MAX_PDF_BYTES) {
    throw new Error("PDF is too large to send on WhatsApp");
  }

  const token = randomUUID();
  const filename = `${token}.pdf`;
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
      `Could not store the report PDF. ${errors[0] ?? "Upload directory is not writable."}`
    );
  }
  return token;
}

export async function readOwnerReportPdf(token: string): Promise<Buffer | null> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const filename = `${token}.pdf`;
  for (const dir of storeDirectories()) {
    try {
      return await readFile(path.join(dir, filename));
    } catch {
      // try the next writable location
    }
  }
  return null;
}
