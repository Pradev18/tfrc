import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

interface DepartmentCardProps {
  name: string;
  label: string;
  description: string;
  count: number;
  imageUrl?: string | null;
  index: number;
}

export function DepartmentCard({
  name,
  label,
  description,
  count,
  imageUrl,
  index,
}: DepartmentCardProps) {
  return (
    <Link
      href={`/catalogue?department=${encodeURIComponent(name)}`}
      prefetch
      className={`animate-fade-in-up group relative block overflow-hidden border border-border bg-surface shadow-[var(--shadow-xs)] transition-shadow hover:shadow-[var(--shadow-soft)] stagger-${index + 1}`}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-surface-muted">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={label}
            fill
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 33vw"
            priority={index === 0}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-primary/5">
            <span className="text-display text-4xl text-primary/20">{label.charAt(0)}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/40 to-transparent opacity-80 transition-opacity group-hover:opacity-90" />
        <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
          <span className="text-[10px] font-bold tabular-nums text-secondary">
            0{index + 1}
          </span>
          <h3 className="text-display mt-2 text-2xl font-medium text-white md:text-3xl">
            {label}
          </h3>
          <p className="mt-1.5 text-sm text-white/75">{description}</p>
          <div className="mt-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/90">
            <span>{count} products</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </div>
    </Link>
  );
}
