import { WhatsAppButton } from "@/components/public/WhatsAppButton";
import { getWhatsAppSettings } from "@/lib/whatsapp";
import { getSocialLinks } from "@/services/settings.service";

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
          Get in touch with PawMart Qatar via WhatsApp for product enquiries, availability, and delivery.
        </p>
        <div className="mt-8">
          <WhatsAppButton href={waHref} label="CHAT ON WHATSAPP" size="lg" />
        </div>
        {socialLinks.length > 0 && (
          <div className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">Follow us</h2>
            <ul className="mt-4 space-y-2">
              {socialLinks.map((s) => (
                <li key={s.id}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
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
