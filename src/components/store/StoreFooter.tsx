import { getWhatsAppSettings } from "@/lib/whatsapp.server";
import { getActiveEnvironments } from "@/services/environment.service";
import { getEnvVisual } from "@/lib/env-visuals";
import { TfrcStaffLink } from "@/components/public/TfrcStaffLink";
import { StoreFooterI18n } from "@/components/store/StoreFooterI18n";
import type { ParsedEnvironment } from "@/services/environment.service";

interface StoreFooterProps {
  environment: ParsedEnvironment;
}

export async function StoreFooter({ environment }: StoreFooterProps) {
  const [waSettings, allEnvs] = await Promise.all([
    getWhatsAppSettings(),
    getActiveEnvironments(),
  ]);
  const waHref = `https://wa.me/${waSettings.phoneNumber}?text=${encodeURIComponent(waSettings.defaultGreeting)}`;
  const v = getEnvVisual(environment.slug);

  return (
    <footer
      className="border-t pb-[var(--mobile-bar-height)] md:pb-10"
      style={{ borderColor: v.border, backgroundColor: v.heading, color: v.surface }}
    >
      <div className="container-pawmart py-8 md:py-10">
        <StoreFooterI18n
          environmentSlug={environment.slug}
          displayName={environment.config.displayName}
          waHref={waHref}
          otherCatalogues={allEnvs
            .filter((e) => e.slug !== environment.slug)
            .map((env) => ({
              slug: env.slug,
              displayName: env.config.displayName,
            }))}
        />
        <div className="mt-3 text-center">
          <TfrcStaffLink className="opacity-40 hover:opacity-70" />
        </div>
      </div>
    </footer>
  );
}
