import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import {
  alternateImageUrls,
  isBrowserDisplayableImageUrl,
} from "@/lib/report/report-image-src";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const FETCH_TIMEOUT_MS = 20000;

const ALLOWED_HOSTS = new Set([
  "pub-c34decbe8eba4a2fa17498e94b1d07b5.r2.dev",
  "pub-48a60a3633b2416d8d515c0e0574569c.r2.dev",
]);

function isAllowedImageHost(hostname: string): boolean {
  if (ALLOWED_HOSTS.has(hostname)) return true;
  if (hostname.endsWith(".r2.dev")) return true;
  return false;
}

function isPrivateHostname(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    return true;
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    const parts = hostname.split(".").map(Number);
    const [a, b] = parts;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
  }
  return false;
}

function parseAllowedUrl(raw: string): URL | null {
  try {
    const target = new URL(raw);
    if (target.protocol !== "https:") return null;
    if (isPrivateHostname(target.hostname) || !isAllowedImageHost(target.hostname)) {
      return null;
    }
    return target;
  } catch {
    return null;
  }
}

function isRenderableImageContentType(contentType: string): boolean {
  const ct = contentType.toLowerCase();
  if (!ct) return true;
  if (ct.includes("emf") || ct.includes("wmf") || ct.includes("tiff")) return false;
  if (ct.startsWith("image/")) return true;
  if (ct.includes("octet-stream") || ct.includes("binary")) return true;
  return false;
}

async function fetchUpstream(url: string): Promise<{
  ok: boolean;
  status: number;
  contentType: string;
  buffer: Buffer | null;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const upstream = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "User-Agent": "TFRC-ReportImageProxy/1.0",
      },
      cache: "force-cache",
    });
    if (!upstream.ok) {
      return { ok: false, status: upstream.status, contentType: "", buffer: null };
    }
    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const buffer = Buffer.from(await upstream.arrayBuffer());
    return { ok: true, status: upstream.status, contentType, buffer };
  } catch {
    return { ok: false, status: 502, contentType: "", buffer: null };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: NextRequest) {
  const { error } = await requireAdminSession();
  if (error) return error;

  const raw = req.nextUrl.searchParams.get("url")?.trim() ?? "";
  if (!raw) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  const primary = parseAllowedUrl(raw);
  if (!primary) {
    return NextResponse.json({ error: "Image host not allowed" }, { status: 403 });
  }

  const candidates = [
    primary.toString(),
    // Always try raster swaps for .emf / missing displayable formats.
    ...(!isBrowserDisplayableImageUrl(raw) || /\.emf(\?|#|$)/i.test(raw)
      ? alternateImageUrls(raw)
      : alternateImageUrls(raw).slice(0, 3)),
  ];

  let lastStatus = 404;
  for (const candidate of [...new Set(candidates)]) {
    if (!parseAllowedUrl(candidate)) continue;
    const result = await fetchUpstream(candidate);
    lastStatus = result.status;
    if (!result.ok || !result.buffer || result.buffer.byteLength === 0) continue;
    if (result.buffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "Image too large" }, { status: 413 });
    }
    if (!isRenderableImageContentType(result.contentType)) {
      // e.g. image/x-emf — try next candidate
      continue;
    }
    // Reject tiny non-images / HTML error pages mistaken as images
    const head = result.buffer.subarray(0, 16).toString("utf8").toLowerCase();
    if (head.includes("<!doctype") || head.includes("<html")) continue;

    const contentType = result.contentType.startsWith("image/")
      ? result.contentType
      : "image/jpeg";

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  return NextResponse.json(
    { error: `No displayable image (last ${lastStatus})` },
    { status: lastStatus === 404 ? 404 : 502 }
  );
}
