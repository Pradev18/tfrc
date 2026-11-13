import type { Metadata } from "next";
import localFont from "next/font/local";
import { Providers } from "@/components/Providers";
import { MetaPixel } from "@/components/analytics/MetaPixel";
import { PLATFORM } from "@/lib/environments";
import { getSiteUrl, META_CONFIG } from "@/lib/site-config";
import "./globals.css";

/**
 * Self-hosted DM Sans — Hostinger builds fail intermittently on next/font/google
 * when Google returns extensionless font URLs (next.js #99114).
 */
const body = localFont({
  src: [
    { path: "./fonts/dm-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/dm-sans-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/dm-sans-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/dm-sans-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: PLATFORM.seo.title,
    template: `%s | ${PLATFORM.fullName}`,
  },
  description: PLATFORM.seo.description,
  keywords: [...PLATFORM.seo.keywords],
  authors: [{ name: "TFRC" }],
  creator: "TFRC",
  publisher: PLATFORM.fullName,
  category: "shopping",
  openGraph: {
    type: "website",
    locale: "en_QA",
    siteName: PLATFORM.fullName,
    title: PLATFORM.seo.title,
    description: PLATFORM.seo.description,
    url: getSiteUrl(),
    images: [
      {
        url: META_CONFIG.defaultOgImage,
        width: 1200,
        height: 630,
        alt: PLATFORM.fullName,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: PLATFORM.seo.title,
    description: PLATFORM.seo.description,
  },
  robots: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
  },
  alternates: {
    canonical: "/",
  },
  ...(META_CONFIG.domainVerification
    ? {
        verification: {
          other: { "facebook-domain-verification": META_CONFIG.domainVerification },
        },
      }
    : {}),
  ...(META_CONFIG.appId ? { other: { "fb:app_id": META_CONFIG.appId } } : {}),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={body.variable}>
      <body>
        <Providers>
          <MetaPixel />
          {children}
        </Providers>
      </body>
    </html>
  );
}
