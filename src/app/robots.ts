import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-config";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api/feeds/"],
        disallow: ["/admin/", "/api/admin/"],
      },
      {
        userAgent: "facebookexternalhit",
        allow: "/",
        disallow: ["/admin/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}