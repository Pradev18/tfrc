import Link from "next/link";
import { cn } from "@/lib/utils";

type GlassButtonVariant = "primary" | "whatsapp" | "deal" | "ghost";

interface GlassButtonProps {
  href: string;
  children: React.ReactNode;
  variant?: GlassButtonVariant;
  external?: boolean;
  className?: string;
}

const variants: Record<GlassButtonVariant, string> = {
  primary:
    "glass-btn bg-[#141414]/90 text-white border-white/10 hover:bg-[#141414] hover:shadow-lg hover:-translate-y-0.5",
  whatsapp:
    "glass-btn bg-[#128c47]/90 text-white border-[#128c47]/30 hover:bg-[#0f7340] hover:shadow-lg hover:-translate-y-0.5",
  deal:
    "glass-btn bg-[#dc2626]/90 text-white border-[#dc2626]/30 hover:bg-[#b91c1c] hover:shadow-lg hover:-translate-y-0.5",
  ghost:
    "glass-btn bg-white/60 text-[#141414] border-white/80 hover:bg-white/90 hover:shadow-md hover:-translate-y-0.5",
};

export function GlassButton({
  href,
  children,
  variant = "primary",
  external,
  className,
}: GlassButtonProps) {
  const cls = cn(
    "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold",
    variants[variant],
    className
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}
