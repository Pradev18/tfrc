import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";

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
  // Public Cloudflare R2.dev buckets used for Cloud Fare image links.
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

export async function GET(req: NextRequest) {
  const { error } = await requireAdminSession();
  if (error) return error;

  const raw = req.nextUrl.searchParams.get("url")?.trim() ?? "";
  if (!raw) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (target.protocol !== "https:") {
    return NextResponse.json({ error: "Only https image urls are allowed" }, { status: 400 });
  }
  if (isPrivateHostname(target.hostname) || !isAllowedImageHost(target.hostname)) {
    return NextResponse.json({ error: "Image host not allowed" }, { status: 403 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const upstream = await fetch(target.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "image/*,*/*;q=0.8",
        "User-Agent": "TFRC-ReportImageProxy/1.0",
      },
      cache: "force-cache",
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream ${upstream.status}` },
        { status: upstream.status === 404 ? 404 : 502 }
      );
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    if (!contentType.startsWith("image/") && !contentType.includes("octet-stream")) {
      return NextResponse.json({ error: "Not an image" }, { status: 415 });
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (buffer.byteLength === 0) {
      return NextResponse.json({ error: "Empty image" }, { status: 502 });
    }
    if (buffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "Image too large" }, { status: 413 });
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType.startsWith("image/") ? contentType : "image/jpeg",
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Fetch failed";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
