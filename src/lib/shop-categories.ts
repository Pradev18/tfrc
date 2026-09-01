export interface ShopCategoryDef {
  slug: string;
  name: string;
  keywords: string[];
  sortOrder: number;
  /** When true, matches products that fit no other category */
  isFallback?: boolean;
}

/** Catch-all for products that don't match defined keywords */
export const OTHER_SHOP_CATEGORY: ShopCategoryDef = {
  slug: "other",
  name: "More to explore",
  keywords: [],
  sortOrder: 999,
  isFallback: true,
};

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "for", "with", "of", "in", "on", "to", "from",
  "set", "pcs", "pc", "piece", "pieces", "new", "premium", "quality", "size",
  "color", "black", "white", "red", "blue", "green", "large", "small", "medium",
  "qatar", "pack", "box", "kit", "item", "product", "brand",
]);

/** Shopper-friendly categories — mapped from product titles, not Excel/Google taxonomy */
export const SHOP_CATEGORIES: Record<string, ShopCategoryDef[]> = {
  pawmart: [
    {
      slug: "leashes-collars",
      name: "Leashes & Collars",
      keywords: ["leash", "collar", "harness", "belt", "lace", "lash", "bandana", "muzzle"],
      sortOrder: 1,
    },
    {
      slug: "toys",
      name: "Toys",
      keywords: ["toy", "ball", "rope", "chew", "teether", "tug", "spiral", "boll", "bone", "feather"],
      sortOrder: 2,
    },
    {
      slug: "grooming",
      name: "Grooming",
      keywords: ["comb", "nail", "clipper", "scissor", "trim", "trimer", "mouth protection", "groom"],
      sortOrder: 3,
    },
    {
      slug: "bowls-feeding",
      name: "Bowls & Feeding",
      keywords: ["bowl", "feeder", "bottle", "nursing", "medicine feed"],
      sortOrder: 4,
    },
    {
      slug: "food-treats",
      name: "Food & Treats",
      keywords: ["food", "treat", "snack", "kibble", "meal"],
      sortOrder: 5,
    },
    {
      slug: "carriers-travel",
      name: "Carriers & Travel",
      keywords: ["carry", "carrier", "bag", "case", "crate"],
      sortOrder: 6,
    },
    {
      slug: "cat-supplies",
      name: "Cat Supplies",
      keywords: ["cat", "scratching", "kitten"],
      sortOrder: 7,
    },
    {
      slug: "clothing-accessories",
      name: "Clothing & Accessories",
      keywords: ["cloth", "shirt", "jacket", "costume", "dress", "raincoat", "apparel", "wear"],
      sortOrder: 8,
    },
  ],
  hardware: [
    {
      slug: "wrenches-spanners",
      name: "Wrenches & Spanners",
      keywords: ["wrench", "spanner", "ratchet", "nut wrench", "flare nut"],
      sortOrder: 1,
    },
    {
      slug: "tool-sets",
      name: "Tool Sets & Kits",
      keywords: ["tool set", "pcs tool", "piece tool", "tool kit", "household tool"],
      sortOrder: 2,
    },
    {
      slug: "power-tools",
      name: "Power Tools",
      keywords: ["cordless", "liion", "battery", "drill", "hammer", "blower", "shear", "charger", "rotary"],
      sortOrder: 3,
    },
    {
      slug: "pliers-cutters",
      name: "Pliers & Cutters",
      keywords: ["plier", "cutter", "snip", "nipper", "crimp"],
      sortOrder: 4,
    },
    {
      slug: "screwdrivers",
      name: "Screwdrivers",
      keywords: ["screwdriver", "screw driver", "bits set"],
      sortOrder: 5,
    },
    {
      slug: "measuring-tools",
      name: "Measuring Tools",
      keywords: ["tape measure", "level", "ruler", "caliper", "measure", "square"],
      sortOrder: 6,
    },
    {
      slug: "hand-tools",
      name: "Hand Tools",
      keywords: ["hammer", "chisel", "file", "saw", "knife", "trowel", "clamp", "vice", "mallet", "punch"],
      sortOrder: 7,
    },
    {
      slug: "sockets-bits",
      name: "Sockets & Bits",
      keywords: ["socket", "bit set", "hex key", "allen", "driver bit", "impact socket"],
      sortOrder: 8,
    },
    {
      slug: "sanding-abrasives",
      name: "Sanding & Abrasives",
      keywords: ["sand", "abrasive", "grit", "polish", "grinder disc", "cutting disc"],
      sortOrder: 9,
    },
    {
      slug: "safety-workwear",
      name: "Safety & Workwear",
      keywords: ["glove", "goggle", "helmet", "mask", "safety", "workwear", "apron"],
      sortOrder: 10,
    },
  ],
  household: [
    {
      slug: "tea-sets",
      name: "Tea Sets",
      keywords: ["tea set", "teaware", "tea cup", "tea glass", "cawa", "teapot", "tea pot"],
      sortOrder: 1,
    },
    {
      slug: "cups-saucers",
      name: "Cups & Saucers",
      keywords: ["cup", "saucer", "mug", "coffee cup"],
      sortOrder: 2,
    },
    {
      slug: "plates-dinnerware",
      name: "Plates & Dinnerware",
      keywords: ["plate", "dinner", "dish", "bowl"],
      sortOrder: 3,
    },
    {
      slug: "serveware-sets",
      name: "Serveware & Sets",
      keywords: ["ceramic set", "glass set", "tray", "serve", "pcs set", "person set"],
      sortOrder: 4,
    },
    {
      slug: "kitchen-home",
      name: "Kitchen & Home",
      keywords: ["kitchen", "home", "storage", "organizer", "decor", "vase", "container", "utensil", "cookware"],
      sortOrder: 5,
    },
    {
      slug: "glassware",
      name: "Glassware",
      keywords: ["glass", "tumbler", "decanter", "carafe", "wine glass", "drinkware"],
      sortOrder: 6,
    },
    {
      slug: "cutlery",
      name: "Cutlery",
      keywords: ["cutlery", "fork", "spoon", "knife set", "flatware", "cutlery set"],
      sortOrder: 7,
    },
  ],
};

export function getShopCategoryDefs(environmentSlug: string): ShopCategoryDef[] {
  return SHOP_CATEGORIES[environmentSlug] ?? [];
}

export function getShopCategoryDef(
  environmentSlug: string,
  shopSlug: string
): ShopCategoryDef | undefined {
  return getShopCategoryDefs(environmentSlug).find((c) => c.slug === shopSlug);
}

/** Case-insensitive keyword match against product name */
export function productMatchesShopCategory(name: string, def: ShopCategoryDef): boolean {
  if (def.isFallback || def.keywords.length === 0) return false;
  const lower = name.toLowerCase();
  return def.keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

/** Best single category for a product — longest keyword wins (most specific) */
export function resolvePrimaryShopCategory(
  productName: string,
  defs: ShopCategoryDef[]
): ShopCategoryDef | null {
  let best: ShopCategoryDef | null = null;
  let bestScore = 0;

  for (const def of defs) {
    if (def.isFallback) continue;
    const lower = productName.toLowerCase();
    for (const kw of def.keywords) {
      const key = kw.toLowerCase();
      if (!lower.includes(key)) continue;
      const score = key.length * 100 - def.sortOrder;
      if (score > bestScore) {
        bestScore = score;
        best = def;
      }
    }
  }

  return best;
}

/**
 * Auto-build shopper categories from product names when none are configured.
 * Used when a new catalogue is added without manual category defs.
 */
export function discoverShopCategoriesFromProducts(
  productNames: string[],
  maxCategories = 8
): ShopCategoryDef[] {
  const freq = new Map<string, number>();

  for (const name of productNames) {
    const tokens = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !STOP_WORDS.has(t) && !/^\d+$/.test(t));

    const seen = new Set<string>();
    for (const token of tokens) {
      if (seen.has(token)) continue;
      seen.add(token);
      freq.set(token, (freq.get(token) ?? 0) + 1);
    }
  }

  return [...freq.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxCategories)
    .map(([token, count], i) => ({
      slug: token.replace(/\s+/g, "-"),
      name: token.charAt(0).toUpperCase() + token.slice(1),
      keywords: [token],
      sortOrder: i + 1,
    }));
}

export function getEffectiveShopCategoryDefs(
  environmentSlug: string,
  productNames: string[] = []
): ShopCategoryDef[] {
  const manual = getShopCategoryDefs(environmentSlug);
  if (manual.length > 0) return manual;
  if (productNames.length === 0) return [];
  return discoverShopCategoriesFromProducts(productNames);
}

export function buildShopCategoryNameFilter(
  defs: ShopCategoryDef[]
): Array<{ name: { contains: string } }> {
  const seen = new Set<string>();
  const or: Array<{ name: { contains: string } }> = [];

  for (const def of defs) {
    for (const kw of def.keywords) {
      const key = kw.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      or.push({ name: { contains: kw } });
    }
  }

  return or;
}
