import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/admin-auth";
import { touchSiteRevision } from "@/lib/site-revision.server";
import { refreshCatalogCacheSafely } from "@/lib/catalog-cache-refresh.server";
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
    await refreshCatalogCacheSafely();
    revalidatePath("/", "layout");
    if (previous?.slug) revalidatePath(`/${previous.slug}`);
    revalidatePath(`/${env.slug}`);
    revalidatePath("/admin/catalogues");
    revalidatePath("/sitemap.xml");
    return NextResponse.json({ catalogue: env });
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
    await refreshCatalogCacheSafely();
    revalidatePath("/", "layout");
    revalidatePath(`/${deleted.slug}`);
    revalidatePath("/admin/catalogues");
    revalidatePath("/sitemap.xml");
    return NextResponse.json({ ok: true, deleted });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Delete failed" },
      { status: 400 }
    );
  }
}
