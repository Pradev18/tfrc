import { getEnvVisual } from "@/lib/env-visuals";

interface StorePageBackdropProps {
  slug: string;
}

/** Static gradient backdrop — no JS animation for smoother scrolling */
export function StorePageBackdrop({ slug }: StorePageBackdropProps) {
  const v = getEnvVisual(slug);

  return (
    <div className="store-backdrop pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(165deg, ${v.heroFrom} 0%, ${v.sectionAlt} 45%, ${v.surface} 100%)`,
        }}
      />
      <div
        className="absolute -left-32 top-[10%] h-80 w-80 rounded-full opacity-40 blur-3xl"
        style={{ background: v.glow }}
      />
      <div
        className="absolute -right-24 top-[35%] h-96 w-96 rounded-full opacity-30 blur-3xl"
        style={{ background: v.glow }}
      />
    </div>
  );
}
