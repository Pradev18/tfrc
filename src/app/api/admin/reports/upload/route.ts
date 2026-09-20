import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import {
  assembleReportUpload,
  createReportUploadSession,
  deleteReportUploadSession,
  saveReportUploadChunk,
  sanitizeExcelUploadName,
} from "@/lib/report/office-report-upload-store";
import { createOfficeReportImport } from "@/services/office-report.service";
import { assertExcelBuffer } from "@/lib/report/excel-file-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_IMPORT_BYTES = 30 * 1024 * 1024;
const MAX_CHUNKS = 200;

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Start a chunked Excel upload (avoids Hostinger/Cloudflare multipart 403s). */
export async function POST(req: NextRequest) {
  try {
    const { session, error } = await requireAdminSession();
    if (error) return error;

    const body = (await req.json().catch(() => null)) as
      | {
          action?: string;
          fileName?: string;
          fileSize?: number;
          totalChunks?: number;
          uploadId?: string;
          index?: number;
          chunkBase64?: string;
        }
      | null;

    if (!body || typeof body !== "object") {
      return jsonError("Invalid upload request.");
    }

    const action = body.action || "init";

    if (action === "init") {
      const fileName = sanitizeExcelUploadName(String(body.fileName || "workbook.xlsx"));
      const fileSize = Number(body.fileSize || 0);
      const totalChunks = Number(body.totalChunks || 0);
      if (fileSize <= 0 || fileSize > MAX_IMPORT_BYTES) {
        return jsonError(
          `Excel problem in “${fileName}”: file size must be between 1 byte and 30 MB.`
        );
      }
      if (!Number.isInteger(totalChunks) || totalChunks < 1 || totalChunks > MAX_CHUNKS) {
        return jsonError("Invalid chunk plan for this upload.");
      }
      const uploadId = await createReportUploadSession({
        fileName,
        fileSize,
        totalChunks,
      });
      return NextResponse.json({ uploadId, fileName });
    }

    if (action === "chunk") {
      const uploadId = String(body.uploadId || "");
      const index = Number(body.index);
      const chunkBase64 = String(body.chunkBase64 || "");
      if (!uploadId || !chunkBase64) return jsonError("Missing upload chunk.");
      const chunk = Buffer.from(chunkBase64, "base64");
      const meta = await saveReportUploadChunk(uploadId, index, chunk);
      return NextResponse.json({
        ok: true,
        received: meta.received.length,
        totalChunks: meta.totalChunks,
      });
    }

    if (action === "complete") {
      const uploadId = String(body.uploadId || "");
      if (!uploadId) return jsonError("Missing upload id.");
      const assembled = await assembleReportUpload(uploadId);
      try {
        assertExcelBuffer(assembled.buffer, assembled.fileName);
        const result = await createOfficeReportImport({
          fileName: assembled.fileName,
          fileSize: assembled.fileSize,
          buffer: assembled.buffer,
          userId: (session?.user as { id?: string } | undefined)?.id ?? null,
        });
        await deleteReportUploadSession(uploadId).catch(() => null);
        return NextResponse.json({
          importId: result.importRecord.id,
          reportId: result.report.id,
          inventorySheetName: result.importRecord.inventorySheetName,
          imageSheetName: result.importRecord.imageSheetName,
          iqsSheetName: result.importRecord.iqsSheetName,
          inventoryRowCount: result.importRecord.inventoryRowCount,
          imageLinkCount: result.importRecord.imageLinkCount,
          seededLineCount: result.seededLineCount,
          uniqueItemCount: result.uniqueItemCount,
          needsSeed: result.needsSeed,
          needsIngest: result.needsIngest,
        });
      } catch (e) {
        await deleteReportUploadSession(uploadId).catch(() => null);
        throw e;
      }
    }

    return jsonError("Unknown upload action.");
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Upload failed");
  }
}
