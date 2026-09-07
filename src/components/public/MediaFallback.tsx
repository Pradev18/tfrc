import { cn } from "@/lib/utils";

export const MEDIA_BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJnIiB4Mj0iMSIgeTI9IjEiPjxzdG9wIHN0b3AtY29sb3I9IiNmOGY2ZjIiLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiNlY2U3ZGYiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cGF0aCBmaWxsPSJ1cmwoI2cpIiBkPSJNMCAwaDQwdjQwSDB6Ii8+PC9zdmc+";

export function MediaFallback({ className }: { className?: string }) {
  return (
    <div
      className={cn("h-full w-full bg-[#f4f1ec]", className)}
      style={{
        background:
          "radial-gradient(circle at 35% 30%, rgba(255,255,255,.95), transparent 38%), linear-gradient(145deg, #f8f6f2 0%, #ece7df 100%)",
      }}
      aria-hidden
    />
  );
}
