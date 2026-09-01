import type { NextRequest } from "next/server";

export interface GeoLocation {
  city?: string;
  region?: string;
  country?: string;
  timezone?: string;
}

export function getClientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0]?.trim();
    if (ip) return ip;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return null;
}

function isPrivateIp(ip: string): boolean {
  return (
    ip === "::1" ||
    ip === "127.0.0.1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
  );
}

export async function lookupGeoFromRequest(request: NextRequest): Promise<GeoLocation> {
  const cfCountry = request.headers.get("cf-ipcountry");
  const ip = getClientIp(request);

  if (!ip || isPrivateIp(ip)) {
    return cfCountry && cfCountry !== "XX" ? { country: cfCountry } : {};
  }

  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,regionName,city,timezone`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return cfCountry ? { country: cfCountry } : {};
    const data = (await res.json()) as {
      status?: string;
      country?: string;
      regionName?: string;
      city?: string;
      timezone?: string;
    };
    if (data.status === "success") {
      return {
        city: data.city ?? undefined,
        region: data.regionName ?? undefined,
        country: data.country ?? cfCountry ?? undefined,
        timezone: data.timezone ?? undefined,
      };
    }
  } catch {
    // Geo lookup is best-effort
  }

  return cfCountry && cfCountry !== "XX" ? { country: cfCountry } : {};
}
