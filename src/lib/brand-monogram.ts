/** First letter/digit for brand tile fallback when no brand_image logo exists. */
export function brandMonogram(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "").trim();
  const letter = cleaned.charAt(0) || name.trim().charAt(0) || "?";
  return letter.toLocaleUpperCase();
}

/** Soft pastel background from brand slug — stable across renders. */
export function brandMonogramBackground(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue} 38% 93%)`;
}

export function brandMonogramForeground(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue} 42% 32%)`;
}
