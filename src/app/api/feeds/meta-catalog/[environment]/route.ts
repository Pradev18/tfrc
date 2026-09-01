import { NextResponse } from "next/server";
import { generateMetaCatalogCsv } from "@/services/meta-catalog.service";
import { isValidEnvironmentSlug } from "@/services/environment.service";

/** Per-environment catalog feed for Meta (PawMart, Hardware, Household) */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ environment: string }> }
) {
  const { environment } = await params;

  if (!isValidEnvironmentSlug(environment)) {
    return NextResponse.json({ error: "Invalid environment" }, { status: 404 });
  }

  const csv = await generateMetaCatalogCsv(environment);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `inline; filename="tfrc-${environment}-catalog.csv"`,
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
