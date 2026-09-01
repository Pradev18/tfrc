import { NextResponse } from "next/server";
import { generateMetaCatalogCsv } from "@/services/meta-catalog.service";

/** Full product catalog feed for Meta Commerce Manager */
export async function GET() {
  const csv = await generateMetaCatalogCsv();

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'inline; filename="tfrc-vita-nova-catalog.csv"',
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
