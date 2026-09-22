import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import {
  assembleCataloguePdfDocument,
  CataloguePdfImageError,
} from "@/lib/catalogue-pdf-build";
import { getSiteUrl } from "@/lib/site-config";
import { requireCatalogueUnlocked } from "@/lib/catalogue-lock";
import { getCataloguePdfPayload, type CataloguePdfPayload } from "@/services/catalogue-pdf.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

type GeneratedCataloguePdf = {
  pdf: Uint8Array;
  payload: CataloguePdfPayload;
};

type CataloguePdfJob = {
  status: "processing" | "ready" | "failed";
  promise: Promise<GeneratedCataloguePdf>;
  result?: GeneratedCataloguePdf;
  error?: unknown;
  createdAt: number;
};

const JOB_TTL_MS = 5 * 60 * 1000;
// Multiple clicks/tabs share one complete job instead of competing for SQLite,
// network and memory. A short ready-result TTL makes repeated clicks instant.
const generationJobs = new Map<string, CataloguePdfJob>();

function startCataloguePdfJob(
  catalogueId: string,
  origin: string,
  reuseReady: boolean
): CataloguePdfJob {
  const existing = generationJobs.get(catalogueId);
  if (
    existing &&
    (existing.status === "processing" ||
      (reuseReady &&
        existing.status === "ready" &&
        Date.now() - existing.createdAt < JOB_TTL_MS))
  ) {
    return existing;
  }

  const job: CataloguePdfJob = {
    status: "processing",
    createdAt: Date.now(),
    promise: Promise.resolve(null as never),
  };
  const scheduleCleanup = () => {
    const timer = setTimeout(() => {
      if (generationJobs.get(catalogueId) === job && job.status !== "processing") {
        generationJobs.delete(catalogueId);
      }
    }, JOB_TTL_MS);
    timer.unref?.();
  };
  job.promise = (async () => {
    const payload = await getCataloguePdfPayload(catalogueId);
    if (!payload) throw new Error("Catalogue not found");
    const { pdf } = await assembleCataloguePdfDocument(payload, { origin });
    return { pdf, payload };
  })().then((result) => {
    job.status = "ready";
    job.result = result;
    scheduleCleanup();
    return result;
  }).catch((error) => {
    job.status = "failed";
    job.error = error;
    scheduleCleanup();
    throw error;
  });

  // The request that starts a background job does not await it. Attach a
  // rejection handler so a failed image source never becomes unhandled.
  void job.promise.catch(() => undefined);
  generationJobs.set(catalogueId, job);
  return job;
}

function errorResponse(error: unknown): NextResponse {
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
  return NextResponse.json(
    {
      error:
        message === "Catalogue not found"
          ? message
          : `${message}. No incomplete PDF was returned.`,
    },
    { status: message === "Catalogue not found" ? 404 : 500 }
  );
}

function pdfResponse({ pdf, payload }: GeneratedCataloguePdf): NextResponse {
  const filename = `${payload.catalogue.slug || "catalogue"}-product-brochure.pdf`;
  return new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "no-store, max-age=0",
      "Content-Disposition": `inline; filename="${filename}"`,
      "X-Catalogue-PDF-Complete": "true",
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
  const job = startCataloguePdfJob(authorized.id, origin, false);
  if (job.status === "ready") return NextResponse.json({ status: "ready" });
  if (job.status === "failed") return errorResponse(job.error);
  return NextResponse.json({ status: "processing" }, { status: 202 });
}

export async function GET(req: NextRequest, context: RouteContext) {
  const authorized = await authorizeCatalogue(context);
  if ("response" in authorized) return authorized.response;

  const origin = (req.nextUrl.origin || getSiteUrl()).replace(/\/$/, "");
  const polling = req.nextUrl.searchParams.get("poll") === "1";
  const existing = generationJobs.get(authorized.id);
  const job =
    polling && existing
      ? existing
      : startCataloguePdfJob(authorized.id, origin, true);

  if (polling && job.status === "processing") {
    return NextResponse.json({ status: "processing" }, { status: 202 });
  }
  if (job.status === "ready" && job.result) return pdfResponse(job.result);
  if (job.status === "failed") return errorResponse(job.error);

  try {
    return pdfResponse(await job.promise);
  } catch (error) {
    return errorResponse(error);
  }
}
