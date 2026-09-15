import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import {
  createOfficeReportImport,
  listOfficeReports,
} from "@/services/office-report.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_IMPORT_BYTES = 30 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["xlsx", "xls"]);

export async function GET() {
  const { error } = await requireAdminSession();
  if (error) return error;
  const reports = await listOfficeReports();
  return NextResponse.json({ reports });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAdminSession();
  if (error) return error;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json(
      { error: "Unsupported file type. Upload an .xlsx or .xls workbook." },
      { status: 400 }
    );
  }
  if (file.size <= 0) {
    return NextResponse.json({ error: "Uploaded file is empty." }, { status: 400 });
  }
  if (file.size > MAX_IMPORT_BYTES) {
    return NextResponse.json(
      { error: "File is too large. Maximum size is 30 MB." },
      { status: 400 }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await createOfficeReportImport({
      fileName: file.name,
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
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to import workbook" },
      { status: 400 }
    );
  }
}
