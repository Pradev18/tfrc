import Link from "next/link";
import { Flame } from "lucide-react";
import { getEnvVisual } from "@/lib/env-visuals";

interface DealsAnnouncementBarProps {
  href: string;
  label?: string;
  environmentSlug: string;
}

export function DealsAnnouncementBar({
  href,
  label = "Today's Deals are live — biggest discounts refresh daily",
  environmentSlug,
}: DealsAnnouncementBarProps) {
  const v = getEnvVisual(environmentSlug);

  return (
    <div
      className="relative overflow-hidden px-3 py-2.5 text-center text-xs font-semibold text-white sm:text-sm"
      style={{
        background: `linear-gradient(90deg, ${v.cta} 0%, ${v.accent} 100%)`,
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)]" />
      <Link href={href} className="relative inline-flex max-w-full items-center justify-center gap-1.5 hover:underline sm:gap-2">
        <Flame className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
        <span className="line-clamp-2 sm:line-clamp-1">{label}</span>
        <span className="hidden shrink-0 sm:inline opacity-90">→ Shop now</span>
      </Link>
    </div>
  );
}
