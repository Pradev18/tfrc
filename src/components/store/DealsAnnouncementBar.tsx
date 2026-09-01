import Link from "next/link";
import { Flame } from "lucide-react";

interface DealsAnnouncementBarProps {
  href?: string;
  label?: string;
}

export function DealsAnnouncementBar({
  href = "/pawmart/catalogue?sale=true&sort=discount",
  label = "Today's Deals are live — biggest discounts refresh daily",
}: DealsAnnouncementBarProps) {
  return (
    <div className="bg-[#dc2626] py-2.5 text-center text-sm font-semibold text-white">
      <Link href={href} className="inline-flex items-center gap-2 hover:underline">
        <Flame className="h-4 w-4" />
        {label}
        <span className="hidden sm:inline">→ Shop now</span>
      </Link>
    </div>
  );
}
