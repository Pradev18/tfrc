import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { getEnvVisual } from "@/lib/env-visuals";

export interface ShopCategoryItem {
  slug: string;
  name: string;
  productCount: number;
  imageUrl?: string | null;
}

interface CategoryScrollProps {
  categories: ShopCategoryItem[];
  environmentSlug: string;
  title?: string;
}

export function CategoryScroll({
  categories,
  environmentSlug,
  title = "Shop by category",
}: CategoryScrollProps) {
  const v = getEnvVisual(environmentSlug);

  if (categories.length === 0) return null;

  return (
    <section className="store-section border-b py-10 md:py-12" style={{ borderColor: v.border, backgroundColor: v.surface }}>
      <div className="container-pawmart">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.22em]"
              style={{ color: v.muted }}
            >
              Browse
            </p>
            <h2 className="mt-1 font-display text-xl font-medium md:text-2xl" style={{ color: v.heading }}>
              {title}
            </h2>
          </div>
          <Link
            href={`/${environmentSlug}/catalogue`}
            className="hidden items-center gap-1 text-sm font-semibold sm:inline-flex"
            style={{ color: v.accent }}
          >
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-hide md:mx-0 md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:px-0 lg:grid-cols-4 xl:grid-cols-8">
          {categories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/${environmentSlug}/catalogue?shop=${cat.slug}`}
              className="store-category-card group w-[7.5rem] shrink-0 md:w-auto"
            >
              <div
                className="relative aspect-square overflow-hidden rounded-2xl border"
                style={{
                  borderColor: v.border,
                  background: `linear-gradient(160deg, ${v.sectionAlt} 0%, ${v.surface} 100%)`,
                  boxShadow: v.cardShadow,
                }}
              >
                {cat.imageUrl ? (
                  <Image
                    src={cat.imageUrl}
                    alt={cat.name}
                    fill
                    className="object-contain p-3 transition-transform duration-500 ease-out group-hover:scale-105"
                    sizes="(max-width:768px) 120px, 160px"
                  />
                ) : (
                  <div
                    className="flex h-full items-center justify-center text-2xl font-bold opacity-30"
                    style={{ color: v.accent }}
                  >
                    {cat.name.charAt(0)}
                  </div>
                )}
                <span
                  className="absolute bottom-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm"
                  style={{ backgroundColor: v.cta }}
                >
                  {cat.productCount}
                </span>
              </div>
              <p
                className="mt-2.5 line-clamp-2 text-center text-xs font-medium leading-snug md:text-sm"
                style={{ color: v.heading }}
              >
                {cat.name}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
