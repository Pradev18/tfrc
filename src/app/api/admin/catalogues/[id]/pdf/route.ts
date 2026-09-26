import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import {
  assembleCataloguePdfDocument,
  CataloguePdfImageError,
} from "@/lib/catalogue-pdf-build";
import { getSiteUrl } from "@/lib/site-config";
import { requireCatalogueUnlocked } from "@/lib/catalogue-lock";
import {
  cataloguePdfJobKey,
  getCataloguePdfPayload,
  normalizeCataloguePdfFilters,
  type CataloguePdfFilters,
  type CataloguePdfPayload,
  type CataloguePdfSort,
} from "@/services/catalogue-pdf.service";
import {
  HeavyJobBusyError,
  heavyJobBusyResponse,
  releaseHeavyJob,
  tryAcquireHeavyJob,
} from "@/lib/admin-heavy-job";
import { randomBytes } from "node:crypto";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

type GeneratedCataloguePdf = {
  pdf: Uint8Array;
  payload: CataloguePdfPayload;
  filters: Required<CataloguePdfFilters>;
};

type CataloguePdfJob = {
  id: string;
  catalogueId: string;
  filters: Required<CataloguePdfFilters>;
  status: "processing" | "ready" | "failed";
  promise: Promise<GeneratedCataloguePdf>;
  result?: GeneratedCataloguePdf;
  error?: unknown;
  createdAt: number;
};

const JOB_TTL_MS = 5 * 60 * 1000;
const generationJobs = new Map<string, CataloguePdfJob>();
const jobsById = new Map<string, CataloguePdfJob>();

function readPdfFiltersFromSearch(req: NextRequest): CataloguePdfFilters {
  const sp = req.nextUrl.searchParams;
  return {
    q: sp.get("q") ?? "",
    shop: sp.get("shop") ?? "",
    sort: (sp.get("sort") as CataloguePdfSort | null) ?? undefined,
  };
}

async function readPdfFilters(req: NextRequest): Promise<Required<CataloguePdfFilters>> {
  const fromQuery = readPdfFiltersFromSearch(req);
  if (req.method === "POST") {
    try {
      const text = await req.text();
      if (text.trim()) {
        const body = JSON.parse(text) as CataloguePdfFilters;
        if (body && typeof body === "object") {
          return normalizeCataloguePdfFilters({
            q: body.q ?? fromQuery.q,
            shop: body.shop ?? fromQuery.shop,
            sort: body.sort ?? fromQuery.sort,
          });
        }
      }
    } catch {
      // empty / non-JSON body — fall through to query params
    }
  }
  return normalizeCataloguePdfFilters(fromQuery);
}

function startCataloguePdfJob(
  catalogueId: string,
  origin: string,
  filters: Required<CataloguePdfFilters>,
  reuseReady: boolean
): CataloguePdfJob {
  const filterKey = cataloguePdfJobKey(catalogueId, filters);
  const existing = generationJobs.get(filterKey);
  if (
    existing &&
    (existing.status === "processing" ||
      (reuseReady &&
        existing.status === "ready" &&
        Date.now() - existing.createdAt < JOB_TTL_MS))
  ) {
    return existing;
  }

  const acquired = tryAcquireHeavyJob("catalogue-pdf");
  if (!acquired.ok) {
    throw new HeavyJobBusyError(acquired.busyWith);
  }

  const jobId = `pdf_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
  const job: CataloguePdfJob = {
    id: jobId,
    catalogueId,
    filters,
    status: "processing",
    createdAt: Date.now(),
    promise: Promise.resolve(null as never),
  };
  const scheduleCleanup = () => {
    const timer = setTimeout(() => {
      if (generationJobs.get(filterKey) === job && job.status !== "processing") {
        generationJobs.delete(filterKey);
      }
      if (jobsById.get(jobId) === job) jobsById.delete(jobId);
    }, JOB_TTL_MS);
    timer.unref?.();
  };
  job.promise = (async () => {
    const payload = await getCataloguePdfPayload(catalogueId, filters);
    if (!payload) throw new Error("Catalogue not found");
    if (payload.listedCards === 0) {
      throw new Error("No products match the current search, category, or sort filters.");
    }
    const { pdf } = await assembleCataloguePdfDocument(payload, { origin });
    return { pdf, payload, filters };
  })()
    .then((result) => {
      job.status = "ready";
      job.result = result;
      scheduleCleanup();
      return result;
    })
    .catch((error) => {
      job.status = "failed";
      job.error = error;
      scheduleCleanup();
      throw error;
    })
    .finally(() => {
      releaseHeavyJob("catalogue-pdf", acquired.token);
    });

  void job.promise.catch(() => undefined);
  generationJobs.set(filterKey, job);
  jobsById.set(jobId, job);
  return job;
}

function errorResponse(error: unknown): NextResponse {
  if (error instanceof HeavyJobBusyError) {
    const busy = heavyJobBusyResponse(error);
    return NextResponse.json(busy.body, {
      status: busy.status,
      headers: { "Retry-After": "15" },
    });
  }
  if (error instanceof CataloguePdfImageError) {
    return NextResponse.json(
      {
        error: error.message,
        incompleteImages: error.failures.length,
        products: error.failures.slice(0, 20),
      },
      { status: 422 }
    );
  }
  const message = error instanceof Error ? error.message : "Catalogue PDF generation failed";
  const notFound = message === "Catalogue not found";
  const emptyFilter =
    message === "No products match the current search, category, or sort filters.";
  return NextResponse.json(
    {
      error:
        notFound || emptyFilter
          ? message
          : `${message}. No incomplete PDF was returned.`,
    },
    { status: notFound ? 404 : emptyFilter ? 404 : 500 }
  );
}

function pdfResponse(result: GeneratedCataloguePdf): NextResponse {
  const filename = `${result.payload.catalogue.slug || "catalogue"}-product-brochure.pdf`;
  return new NextResponse(Buffer.from(result.pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "no-store, max-age=0",
      "Content-Disposition": `inline; filename="${filename}"`,
      "X-Catalogue-PDF-Complete": "true",
      "X-Catalogue-PDF-Sort": result.filters.sort,
    },
  });
}

async function authorizeCatalogue(context: RouteContext): Promise<
  | { id: string }
  | { response: NextResponse }
> {
  const { error } = await requireAdminSession();
  if (error) return { response: error };
  const { id } = await context.params;
  const lockError = await requireCatalogueUnlocked(id);
  if (lockError) return { response: lockError };
  return { id };
}

export async function POST(req: NextRequest, context: RouteContext) {
  const authorized = await authorizeCatalogue(context);
  if ("response" in authorized) return authorized.response;

  const origin = (req.nextUrl.origin || getSiteUrl()).replace(/\/$/, "");
  const filters = await readPdfFilters(req);
  try {
    // Always start a fresh job for the requested filters (no stale ready PDF).
    const job = startCataloguePdfJob(authorized.id, origin, filters, false);
    if (job.status === "failed") return errorResponse(job.error);
    return NextResponse.json(
      {
        status: job.status === "ready" ? "ready" : "processing",
        jobId: job.id,
        sort: filters.sort,
        q: filters.q,
        shop: filters.shop,
      },
      { status: job.status === "ready" ? 200 : 202 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(req: NextRequest, context: RouteContext) {
  const authorized = await authorizeCatalogue(context);
  if ("response" in authorized) return authorized.response;

  const origin = (req.nextUrl.origin || getSiteUrl()).replace(/\/$/, "");
  const polling = req.nextUrl.searchParams.get("poll") === "1";
  const jobId = req.nextUrl.searchParams.get("jobId")?.trim() || "";
  const filters = await readPdfFilters(req);

  try {
    let job: CataloguePdfJob | undefined = jobId ? jobsById.get(jobId) : undefined;

    if (!job) {
      const existing = generationJobs.get(cataloguePdfJobKey(authorized.id, filters));
      job =
        polling && existing
          ? existing
          : startCataloguePdfJob(authorized.id, origin, filters, !polling);
    }

    if (polling && job.status === "processing") {
      return NextResponse.json(
        { status: "processing", jobId: job.id, sort: job.filters.sort },
        { status: 202 }
      );
    }
    if (job.status === "ready" && job.result) return pdfResponse(job.result);
    if (job.status === "failed") return errorResponse(job.error);

    return pdfResponse(await job.promise);
  } catch (error) {
    return errorResponse(error);
  }
}
