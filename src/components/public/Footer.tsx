import Link from "next/link";
import { getSiteSettings, getSocialLinks } from "@/services/settings.service";
import { getWhatsAppSettings } from "@/lib/whatsapp.server";
import { PLATFORM } from "@/lib/environments";
import { getActiveEnvironments } from "@/services/environment.service";
import { getEnvVisual } from "@/lib/env-visuals";
import { EnvIcon } from "@/components/public/EnvIcon";
import { TfrcStaffLink } from "@/components/public/TfrcStaffLink";

export async function Footer() {
  const [settings, socialLinks, waSettings, activeEnvs] = await Promise.all([
    getSiteSettings(),
    getSocialLinks(),
    getWhatsAppSettings(),
    getActiveEnvironments(),
  ]);

  const tagline = settings.site_tagline ?? PLATFORM.description;
  const waHref = `https://wa.me/${waSettings.phoneNumber}?text=${encodeURIComponent(waSettings.defaultGreeting)}`;

  return (
    <footer className="border-t border-[#ebe8e3] bg-[#141414] text-white">
      <div className="container-pawmart section-padding-sm">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-4">
            <p className="font-display text-[1.75rem] font-medium">{PLATFORM.name}</p>
            <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.35em] text-white/45">
              {PLATFORM.tagline}
            </p>
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/60">
              {tagline}
            </p>
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex rounded-full border border-white/20 px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white transition-colors hover:border-white/40 hover:bg-white/5"
            >
              WhatsApp Us
            </a>
          </div>

          <div className="lg:col-span-4">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
              Catalogues
            </h4>
            <ul className="mt-5 space-y-3">
              <li>
                <Link
                  href="/"
                  className="text-sm text-white/65 transition-colors hover:text-white"
                >
                  All Catalogues
                </Link>
              </li>
              {activeEnvs.map((env) => {
                const v = getEnvVisual(env.slug);
                return (
                  <li key={env.slug}>
                    <Link
                      href={`/${env.slug}`}
                      className="inline-flex items-center gap-2.5 text-sm text-white/65 transition-colors hover:text-white"
                    >
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-md"
                        style={{ background: v.gradientAccent, color: v.heading }}
                      >
                        <EnvIcon slug={env.slug} className="h-3 w-3" />
                      </span>
                      {env.config.displayName}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="lg:col-span-4">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
              Connect
            </h4>
            <ul className="mt-5 space-y-3">
              <li>
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-white/65 transition-colors hover:text-white"
                >
                  WhatsApp · +{waSettings.phoneNumber}
                </a>
              </li>
              {socialLinks.map((s) => (
                <li key={s.id}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white/65 transition-colors hover:text-white"
                  >
                    {s.platform}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 md:flex-row">
          <p className="text-[11px] text-white/35">
            © {new Date().getFullYear()} {PLATFORM.fullName}. Qatar.
          </p>
          <TfrcStaffLink className="text-white/30 hover:text-white/50" />
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/30">
            Order on WhatsApp
          </p>
        </div>
      </div>
    </footer>
  );
}
