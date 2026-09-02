import { NextRequest, NextResponse } from "next/server";
import { readUploadedImage } from "@/lib/upload";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ name: string }>;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const { name } = await context.params;
  const filename = decodeURIComponent(name);
  const file = await readUploadedImage(filename);

  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(file.buffer), {
    status: 200,
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(file.buffer.length),
    },
  });
}
