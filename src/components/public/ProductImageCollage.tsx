import Image from "next/image";
import { cn } from "@/lib/utils";

interface ProductImageCollageProps {
  images: string[];
  alt: string;
  className?: string;
  layout?: "grid" | "hero" | "strip";
}

const cellStyle = {
  position: "relative" as const,
  overflow: "hidden" as const,
  backgroundColor: "#ffffff",
};

/** Marketing collage — images fill each cell edge-to-edge */
export function ProductImageCollage({
  images,
  alt,
  className,
  layout = "grid",
}: ProductImageCollageProps) {
  const urls = images.filter(Boolean).slice(0, layout === "strip" ? 6 : 4);

  if (urls.length === 0) {
    return (
      <div
        className={cn("flex items-center justify-center bg-[#f5f3f0]", className)}
        style={{ minHeight: 200 }}
        aria-hidden
      >
        <span className="text-sm text-[#9c9690]">No preview</span>
      </div>
    );
  }

  if (layout === "strip") {
    return (
      <div className={cn("flex gap-2 overflow-hidden", className)} style={{ maxHeight: 120 }}>
        {urls.map((url, i) => (
          <div
            key={url}
            style={{ ...cellStyle, width: 100, height: 100, flexShrink: 0, borderRadius: 8 }}
          >
            <Image
              src={url}
              alt={`${alt} ${i + 1}`}
              width={100}
              height={100}
              className="h-full w-full object-cover"
            />
          </div>
        ))}
      </div>
    );
  }

  if (layout === "hero") {
    const [main, ...rest] = urls;
    return (
      <div
        className={cn("grid gap-2", className)}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr 1fr",
          maxWidth: 420,
          width: "100%",
          aspectRatio: "1 / 1",
        }}
      >
        <div
          style={{
            ...cellStyle,
            gridRow: "span 2",
            borderRadius: 12,
            minHeight: 0,
          }}
        >
          <Image
            src={main}
            alt={alt}
            width={280}
            height={420}
            className="h-full w-full object-cover"
            priority
          />
        </div>
        {rest.slice(0, 3).map((url, i) => (
          <div
            key={url}
            style={{ ...cellStyle, borderRadius: 12, minHeight: 0, aspectRatio: "1 / 1" }}
          >
            <Image
              src={url}
              alt={`${alt} ${i + 2}`}
              width={140}
              height={140}
              className="h-full w-full object-cover"
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn("grid grid-cols-2 gap-1.5", className)}
      style={{ maxWidth: 320, width: "100%" }}
    >
      {urls.map((url, i) => (
        <div
          key={url}
          style={{ ...cellStyle, aspectRatio: "1 / 1", borderRadius: 8 }}
        >
          <Image
            src={url}
            alt={`${alt} ${i + 1}`}
            width={160}
            height={160}
            className="h-full w-full object-cover"
          />
        </div>
      ))}
    </div>
  );
}
