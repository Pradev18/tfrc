import { ShieldCheck, Sparkles, Truck } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { getEnvVisual } from "@/lib/env-visuals";

interface TrustStripProps {
  environmentSlug: string;
}

const ITEMS: Array<{ label: string; icon: typeof Sparkles; whatsApp?: boolean }> = [
  { icon: Sparkles, label: "Real product photos" },
  { icon: Sparkles, label: "WhatsApp checkout", whatsApp: true },
  { icon: ShieldCheck, label: "Curated catalogue" },
  { icon: Truck, label: "Qatar delivery" },
];

export function TrustStrip({ environmentSlug }: TrustStripProps) {
  const v = getEnvVisual(environmentSlug);

  return (
    <section className="store-section py-6 md:py-8">
      <div className="container-pawmart">
        <div className="glass-panel grid grid-cols-2 gap-3 p-4 md:grid-cols-4 md:gap-4 md:p-5">
          {ITEMS.map(({ icon: Icon, label, whatsApp }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-2 rounded-xl px-3 py-3 text-center md:flex-row md:text-left"
              style={{ backgroundColor: `${v.badgeBg}88` }}
            >
              {whatsApp ? (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#128c47]/12 text-[#128c47]">
                  <WhatsAppIcon className="h-4 w-4" />
                </span>
              ) : (
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: v.badgeBg, color: v.accent }}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </span>
              )}
              <span className="text-xs font-medium leading-snug md:text-sm" style={{ color: v.heading }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
