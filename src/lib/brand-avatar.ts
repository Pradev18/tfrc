/**
 * Store/admin brand letter mark when no brand_image URL is set.
 * Kept separate from product imagery so brand tiles never borrow item photos.
 */
export function brandInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const letter = trimmed.charAt(0).toLocaleUpperCase();
  return /[A-Z0-9]/i.test(letter) ? letter : trimmed.charAt(0);
}

/** Stable soft tone from the brand name (modern avatar chip). */
export function brandAvatarTone(name: string): { bg: string; fg: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  const hues = [205, 168, 28, 286, 340, 188, 48, 152];
  const hue = hues[hash % hues.length]!;
  return {
    bg: `hsl(${hue} 48% 94%)`,
    fg: `hsl(${hue} 38% 34%)`,
  };
}
