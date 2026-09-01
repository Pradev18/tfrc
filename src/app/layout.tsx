import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import { Providers } from "@/components/Providers";
import { MetaPixel } from "@/components/analytics/MetaPixel";
import { PLATFORM } from "@/lib/environments";
import { getSiteUrl, META_CONFIG } from "@/lib/site-config";
import "./globals.css";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600"],
  display: "swap",
});

const body = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
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
  robots: { index: true, follow: true, "max-image-preview": "large" },
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
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <Providers>
          <MetaPixel />
          {children}
        </Providers>
      </body>
    </html>
  );
}
