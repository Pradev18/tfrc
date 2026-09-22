import type { Metadata } from "next";
import { WhatsAppButton } from "@/components/public/WhatsAppButton";
import { getWhatsAppSettings } from "@/lib/whatsapp.server";
import { getSocialLinks } from "@/services/settings.service";
import { PLATFORM } from "@/lib/environments";
import { buildPageMetadata } from "@/lib/meta-seo";

export const metadata: Metadata = buildPageMetadata({
  title: `Contact ${PLATFORM.fullName}`,
  description: `Contact ${PLATFORM.fullName} in Qatar by email ${PLATFORM.email} or WhatsApp for wholesale catalogue enquiries.`,
  path: "/contact",
  keywords: [
    ...PLATFORM.seo.keywords,
    "contact tfrc",
    "tfrcwholesale email",
    PLATFORM.email,
  ],
});

export default async function ContactPage() {
  const [waSettings, socialLinks] = await Promise.all([
    getWhatsAppSettings(),
    getSocialLinks(),
  ]);

  const waHref = `https://wa.me/${waSettings.phoneNumber}?text=${encodeURIComponent(waSettings.defaultGreeting)}`;

  return (
    <div className="container-pawmart section-padding">
      <h1 className="text-display text-4xl text-primary md:text-5xl">Contact Us</h1>
      <p className="mt-4 max-w-xl text-text-muted">
        Get in touch with {PLATFORM.fullName} for product enquiries, availability, and wholesale
        orders.
      </p>

      <div className="mt-8 space-y-4">
        <p className="text-sm text-text">
          Email:{" "}
          <a
            href={`mailto:${PLATFORM.email}`}
            className="font-semibold text-primary hover:underline"
          >
            {PLATFORM.email}
          </a>
        </p>
        <WhatsAppButton href={waHref} label="CHAT ON WHATSAPP" size="lg" />
      </div>

      {socialLinks.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
            Follow us
          </h2>
          <ul className="mt-4 space-y-2">
            {socialLinks.map((s) => (
              <li key={s.id}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {s.platform}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
