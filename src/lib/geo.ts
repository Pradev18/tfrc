import type { NextRequest } from "next/server";

export interface GeoLocation {
  city?: string;
  region?: string;
  country?: string;
  timezone?: string;
}

const GEO_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const GEO_CACHE_MAX_ENTRIES = 2000;
const geoCache = new Map<string, { value: GeoLocation; expiresAt: number }>();

function cacheGeo(ip: string, value: GeoLocation): GeoLocation {
  if (geoCache.size >= GEO_CACHE_MAX_ENTRIES) {
    const oldest = geoCache.keys().next().value as string | undefined;
    if (oldest) geoCache.delete(oldest);
  }
  geoCache.set(ip, { value, expiresAt: Date.now() + GEO_CACHE_TTL_MS });
  return value;
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

  const cached = geoCache.get(ip);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  if (cached) geoCache.delete(ip);

  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,regionName,city,timezone`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) {
      return cacheGeo(ip, cfCountry && cfCountry !== "XX" ? { country: cfCountry } : {});
    }
    const data = (await res.json()) as {
      status?: string;
      country?: string;
      regionName?: string;
      city?: string;
      timezone?: string;
    };
    if (data.status === "success") {
      return cacheGeo(ip, {
        city: data.city ?? undefined,
        region: data.regionName ?? undefined,
        country: data.country ?? cfCountry ?? undefined,
        timezone: data.timezone ?? undefined,
      });
    }
  } catch {
    // Geo lookup is best-effort
  }

  return cacheGeo(
    ip,
    cfCountry && cfCountry !== "XX" ? { country: cfCountry } : {}
  );
}
