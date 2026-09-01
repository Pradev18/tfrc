import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getCatalogueById } from "@/services/catalogue-admin.service";
import { importCatalogueExcel } from "@/services/catalogue-import.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

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
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import failed" },
      { status: 500 }
    );
  }
}
