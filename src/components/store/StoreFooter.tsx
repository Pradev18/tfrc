import Link from "next/link";
import { getWhatsAppSettings } from "@/lib/whatsapp.server";
import { getActiveEnvironments } from "@/services/environment.service";
import { getEnvVisual } from "@/lib/env-visuals";
import { TfrcStaffLink } from "@/components/public/TfrcStaffLink";
import type { ParsedEnvironment } from "@/services/environment.service";
interface StoreFooterProps {
  environment: ParsedEnvironment;
}

export async function StoreFooter({ environment }: StoreFooterProps) {
  const [waSettings, allEnvs] = await Promise.all([
    getWhatsAppSettings(),
    getActiveEnvironments(),
  ]);  const waHref = `https://wa.me/${waSettings.phoneNumber}?text=${encodeURIComponent(waSettings.defaultGreeting)}`;
  const v = getEnvVisual(environment.slug);

  return (
    <footer
      className="border-t pb-[var(--mobile-bar-height)] md:pb-10"
      style={{ borderColor: v.border, backgroundColor: v.heading, color: v.surface }}
    >
      <div className="container-pawmart py-8 md:py-10">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <p className="font-display text-xl font-medium">{environment.config.displayName}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.2em] opacity-60">by TFRC · Qatar</p>
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex rounded-full border border-white/25 px-4 py-2 text-xs font-semibold transition-colors hover:bg-white/10"
            >
              Order on WhatsApp
            </a>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-50">Shop</p>
            <ul className="mt-3 space-y-2 text-sm opacity-80">
              <li>
                <Link href={`/${environment.slug}#catalog`} className="hover:opacity-100">
                  Browse all products
                </Link>
              </li>
              <li>
                <Link href={`/${environment.slug}#deals`} className="hover:opacity-100">
                  Today&apos;s deals
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-50">Catalogues</p>
            <ul className="mt-3 space-y-2 text-sm opacity-80">
              <li>
                <Link href="/" className="hover:opacity-100">
                  All catalogues
                </Link>
              </li>
              {allEnvs.filter((e) => e.slug !== environment.slug).map((env) => (
                <li key={env.slug}>
                  <Link href={`/${env.slug}`} className="hover:opacity-100">
                    {env.config.displayName}
                  </Link>
                </li>
              ))}            </ul>
          </div>
        </div>

        <p className="mt-8 text-center text-[11px] opacity-40">
          © {new Date().getFullYear()} TFRC · WhatsApp ordering · Qatar
        </p>
        <div className="mt-3 text-center">
          <TfrcStaffLink className="opacity-40 hover:opacity-70" />
        </div>      </div>
    </footer>
  );
}
