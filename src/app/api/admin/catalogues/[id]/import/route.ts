import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/admin-auth";
import { getCatalogueById } from "@/services/catalogue-admin.service";
import { importCatalogueExcel } from "@/services/catalogue-import.service";
import {
  processCatalogueImportChunk,
  startChunkedCatalogueImport,
} from "@/services/catalogue-import-chunked.service";
import { touchSiteRevision } from "@/lib/site-revision.server";
import { requireCatalogueUnlocked } from "@/lib/catalogue-lock";
import {
  HeavyJobBusyError,
  heavyJobBusyResponse,
  withHeavyJob,
} from "@/lib/admin-heavy-job";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const MAX_IMPORT_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["xlsx", "xls"]);

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest, context: RouteContext) {
  const { session, error } = await requireAdminSession();
  if (error) return error;

  const { id } = await context.params;
  const lockError = await requireCatalogueUnlocked(id);
  if (lockError) return lockError;

  const catalogue = await getCatalogueById(id);
  if (!catalogue) {
    return NextResponse.json({ error: "Catalogue not found" }, { status: 404 });
  }

  const formData = await req.formData();
  const continueJobId = String(formData.get("jobId") || "").trim();
  const preview = formData.get("preview") === "true";
  const mode =
    formData.get("mode") === "replace" ? ("replace" as const) : ("merge" as const);
  const department = catalogue.departmentSource ?? catalogue.name;

  try {
    // Resume next chunk of an in-progress import (no file required).
    if (continueJobId && !preview) {
      const result = await withHeavyJob("catalogue-import", () =>
        processCatalogueImportChunk(continueJobId)
      );

      if (result.applied) {
        const slug = catalogue.slug;
        after(() => {
          void touchSiteRevision()
            .then(() => {
              revalidatePath("/", "layout");
              revalidatePath(`/${slug}`);
              revalidatePath(`/${slug}`, "layout");
              revalidatePath(`/admin/catalogues/${id}`);
              revalidatePath("/admin/catalogues");
              revalidatePath("/api/store/" + slug + "/products");
            })
            .catch(() => {});
        });
      }

      return NextResponse.json(result, {
        headers: { "Cache-Control": "no-store, max-age=0" },
      });
    }

    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return NextResponse.json(
        { error: "Choose a Meta catalogue Excel file (.xlsx or .xls)" },
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

    // Preview stays single-request (validation only).
    if (preview) {
      const result = await withHeavyJob("catalogue-import", () =>
        importCatalogueExcel({
          buffer,
          fileName: file.name,
          department,
          environmentId: id,
          environmentSlug: catalogue.slug,
          userId: session!.user?.id,
          preview: true,
          mode,
        })
      );
      return NextResponse.json(result, {
        status: result.canImport ? 200 : 422,
        headers: { "Cache-Control": "no-store, max-age=0" },
      });
    }

    // Apply: chunked resumable import (30 rows per request).
    const result = await withHeavyJob("catalogue-import", () =>
      startChunkedCatalogueImport({
        buffer,
        fileName: file.name,
        department,
        environmentId: id,
        environmentSlug: catalogue.slug,
        userId: session!.user?.id,
        mode,
      })
    );

    if (result.applied) {
      const slug = catalogue.slug;
      after(() => {
        void touchSiteRevision()
          .then(() => {
            revalidatePath("/", "layout");
            revalidatePath(`/${slug}`);
            revalidatePath(`/${slug}`, "layout");
            revalidatePath(`/admin/catalogues/${id}`);
            revalidatePath("/admin/catalogues");
            revalidatePath("/api/store/" + slug + "/products");
          })
          .catch(() => {});
      });
    }

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (e) {
    if (e instanceof HeavyJobBusyError) {
      const busy = heavyJobBusyResponse(e);
      return NextResponse.json(busy.body, {
        status: busy.status,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(busy.body.retryAfterSec || 15),
        },
      });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import failed" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}
