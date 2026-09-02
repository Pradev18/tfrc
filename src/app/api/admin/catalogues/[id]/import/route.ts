import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getCatalogueById } from "@/services/catalogue-admin.service";
import { importCatalogueExcel } from "@/services/catalogue-import.service";
import { touchSiteRevision } from "@/lib/site-revision.server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const MAX_IMPORT_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["xlsx", "xls", "csv"]);

export async function POST(req: NextRequest, context: RouteContext) {
  const { session, error } = await requireAdminSession();
  if (error) return error;

  const { id } = await context.params;
  const catalogue = await getCatalogueById(id);
  if (!catalogue) return NextResponse.json({ error: "Catalogue not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const preview = formData.get("preview") === "true";

  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return NextResponse.json(
      { error: "Choose an Excel (.xlsx, .xls) or CSV file" },
      { status: 400 }
    );
  }
  if (file.size === 0 || file.size > MAX_IMPORT_BYTES) {
    return NextResponse.json(
      { error: "The catalogue file must be between 1 byte and 25 MB" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const department = catalogue.departmentSource ?? catalogue.name;

  try {
    const result = await importCatalogueExcel({
      buffer,
      fileName: file.name,
      department,
      environmentId: id,
      environmentSlug: catalogue.slug,
      userId: session!.user?.id,
      preview,
    });
    if (!preview && result.applied) await touchSiteRevision();
    return NextResponse.json(result, {
      status: !preview && !result.applied ? 422 : 200,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import failed" },
      { status: 400 }
    );
  }
}
