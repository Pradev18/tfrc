import { PawPrint, Wrench, Sparkles, Store, type LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = {
  pawmart: PawPrint,
  hardware: Wrench,
  household: Sparkles,
} as const;

type EnvSlug = keyof typeof ICONS;

interface EnvIconProps extends LucideProps {
  slug: string;
}

export function EnvIcon({ slug, className, strokeWidth = 1.25, ...props }: EnvIconProps) {
  const Icon = ICONS[slug as EnvSlug] ?? Store;
  return <Icon className={cn("shrink-0", className)} strokeWidth={strokeWidth} {...props} />;
}
