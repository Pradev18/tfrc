import Link from "next/link";
import Image from "next/image";

interface CategoryCardProps {
  name: string;
  slug: string;
  environmentSlug: string;
  imageUrl?: string | null;
  description?: string | null;
}

export function CategoryCard({
  name,
  slug,
  environmentSlug,
  imageUrl,
  description,
}: CategoryCardProps) {
  return (
    <Link
      href={`/${environmentSlug}/catalogue/${slug}`}
      className="card-premium group relative overflow-hidden"
    >
      <div className="relative aspect-[5/4] bg-surface-muted">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-primary/[0.04] to-secondary/[0.08]">
            <span className="text-display text-5xl font-light text-primary/20">
              {name.charAt(0)}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-6">
          <h3 className="text-display text-2xl font-medium text-white">{name}</h3>
        </div>
      </div>
      {description && (
        <div className="flex items-center justify-between border-t border-border p-4">
          <p className="line-clamp-2 text-sm text-text-muted">{description}</p>
        </div>
      )}
    </Link>
  );
}
