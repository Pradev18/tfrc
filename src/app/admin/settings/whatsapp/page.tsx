import { WhatsAppSettingsForm } from "@/components/admin/WhatsAppSettingsForm";
import { getSiteUrl } from "@/lib/site-config";
import { getWhatsAppSettings } from "@/lib/whatsapp.server";

export default async function WhatsAppSettingsPage() {
  const settings = await getWhatsAppSettings();

  return (
    <div>
      <h1 className="text-display text-3xl text-primary">WhatsApp Settings</h1>
      <p className="mt-2 text-text-muted">
        Configure your WhatsApp number and the greeting customers see at the start of each order
        message.
      </p>

      <WhatsAppSettingsForm initialSettings={settings} siteUrl={getSiteUrl()} />
    </div>
  );
}
