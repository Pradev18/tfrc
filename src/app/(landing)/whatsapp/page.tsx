import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getWhatsAppAdUrl } from "@/lib/site-config";
import { buildPageMetadata } from "@/lib/meta-seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Order on WhatsApp | TFRC Vita Nova",
  description: "Chat with TFRC Vita Nova on WhatsApp to place your order in Qatar.",
  path: "/whatsapp",
  noIndex: true,
});

interface PageProps {
  searchParams: Promise<{ source?: string; campaign?: string }>;
}

/**
 * Meta Click-to-WhatsApp ad destination.
 * Use in Facebook/Instagram ads: yourdomain.com/whatsapp
 */
export default async function WhatsAppAdPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const source = params.campaign
    ? `Meta ad (${params.campaign})`
    : params.source
      ? decodeURIComponent(params.source)
      : "Meta ad";

  redirect(getWhatsAppAdUrl(source));
}
