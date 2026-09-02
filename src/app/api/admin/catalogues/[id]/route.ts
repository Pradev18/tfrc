import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/admin-auth";
import { touchSiteRevision } from "@/lib/site-revision.server";
import { persistRuntimeCatalogueDataSafely } from "@/lib/persist-runtime-data.server";
import {
  getCatalogueById,
  updateCatalogue,
  deleteCatalogue,
  generateShopCategories,
} from "@/services/catalogue-admin.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const { error } = await requireAdminSession();
  if (error) return error;

  const { id } = await context.params;
  const catalogue = await getCatalogueById(id);
  if (!catalogue) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ catalogue });
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { session, error } = await requireAdminSession();
  if (error) return error;

  const { id } = await context.params;
  try {
    const body = await req.json();
    const previous = await getCatalogueById(id);
    const env = await updateCatalogue(id, body, session!.user?.id);
    await touchSiteRevision();
    await persistRuntimeCatalogueDataSafely();
    revalidatePath("/", "layout");
    if (previous?.slug) {
      revalidatePath(`/${previous.slug}`);
      revalidatePath(`/${previous.slug}`, "layout");
    }
    revalidatePath(`/${env.slug}`);
    revalidatePath(`/${env.slug}`, "layout");
    revalidatePath("/admin/catalogues");
    revalidatePath(`/admin/catalogues/${id}`);
    revalidatePath("/sitemap.xml");
    return NextResponse.json(
      { catalogue: env },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Update failed" },
      { status: 400 }
    );
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const { session, error } = await requireAdminSession();
  if (error) return error;

  const { id } = await context.params;
  try {
    const deleted = await deleteCatalogue(id, session!.user?.id);
    await touchSiteRevision();
    await persistRuntimeCatalogueDataSafely();
    revalidatePath("/", "layout");
    revalidatePath(`/${deleted.slug}`);
    revalidatePath(`/${deleted.slug}`, "layout");
    revalidatePath("/admin/catalogues");
    revalidatePath("/sitemap.xml");
    return NextResponse.json(
      { ok: true, deleted },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Delete failed" },
      { status: 400 }
    );
  }
}
