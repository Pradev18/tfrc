import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import {
  createOfficeReportImport,
  listOfficeReports,
} from "@/services/office-report.service";
import { assertExcelBuffer } from "@/lib/report/excel-file-guard";
import { sanitizeExcelUploadName } from "@/lib/report/office-report-upload-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_IMPORT_BYTES = 30 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["xlsx", "xls"]);

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    const { error } = await requireAdminSession();
    if (error) return error;
    const reports = await listOfficeReports();
    return NextResponse.json({ reports });
  } catch (e) {
    return jsonError(
      e instanceof Error ? e.message : "Failed to list reports",
      500
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session, error } = await requireAdminSession();
    if (error) return error;

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return jsonError(
        "Upload did not arrive as a file. Refresh the page and choose the Excel workbook again."
      );
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return jsonError("No file uploaded. Choose an .xlsx or .xls Office Forms workbook.");
    }

    const fileName = sanitizeExcelUploadName(file.name || "workbook.xlsx");
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return jsonError(
        `Excel problem in “${fileName}”: unsupported file type. Upload an .xlsx or .xls workbook.`
      );
    }
    if (file.size <= 0) {
      return jsonError(`Excel problem in “${fileName}”: the uploaded file is empty.`);
    }
    if (file.size > MAX_IMPORT_BYTES) {
      return jsonError(
        `Excel problem in “${fileName}”: file is too large (${Math.round(file.size / (1024 * 1024))} MB). Maximum is 30 MB.`
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    try {
      assertExcelBuffer(buffer, fileName);
    } catch (e) {
      return jsonError(e instanceof Error ? e.message : "Invalid Excel file.");
    }

    const result = await createOfficeReportImport({
      fileName,
      fileSize: file.size,
      buffer,
      userId: (session?.user as { id?: string } | undefined)?.id ?? null,
    });

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
    const message = e instanceof Error ? e.message : "Failed to import workbook";
    const status = message.startsWith("Excel problem") ? 400 : 400;
    return jsonError(message, status);
  }
}
