import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import {
  forceClearHeavyJobs,
  getActiveHeavyJobs,
  type HeavyJobKind,
} from "@/lib/admin-heavy-job";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** See which heavy jobs are holding the import gate. */
export async function GET() {
  const { error } = await requireAdminSession();
  if (error) return error;

  return NextResponse.json({
    ok: true,
    active: getActiveHeavyJobs(),
  });
}

/**
 * Clear a stuck catalogue-import lock (e.g. after a killed upload).
 * Body optional: { kinds?: ["catalogue-import"] }
 */
export async function POST(req: NextRequest) {
  const { error } = await requireAdminSession();
  if (error) return error;

  let kinds: HeavyJobKind[] | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    if (Array.isArray(body?.kinds)) {
      kinds = body.kinds.filter((k: unknown): k is HeavyJobKind =>
        typeof k === "string"
      );
    }
  } catch {
    /* empty body = clear all */
  }

  const cleared = forceClearHeavyJobs(
    kinds?.length ? kinds : ["catalogue-import", "catalogue-pdf"]
  );

  return NextResponse.json({
    ok: true,
    cleared,
    active: getActiveHeavyJobs(),
  });
}
