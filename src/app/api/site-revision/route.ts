import { NextResponse } from "next/server";
import { getSiteRevision } from "@/lib/site-revision.server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const revision = await getSiteRevision();

    return NextResponse.json(
      { revision },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch {
    return NextResponse.json(
      { revision: null },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
